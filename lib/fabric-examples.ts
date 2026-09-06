import { profileFor } from './catalog.ts';
import { type ClusterModel, type Hardware, type Fabric } from './hardware.ts';
import {
  equipment,
  firstFreeU,
  placeHardware,
  addConnection,
  portBudget,
} from './rack-builder.ts';
export function canShowFabricExample(model: ClusterModel) {
  return (
    !model.custom && model.id !== 'h100-cluster' && model.hardware.length > 0
  );
}
export function withFabricExample(base: ClusterModel): ClusterModel {
  if (!canShowFabricExample(base) || base.fabricExample) return base;
  const roles: Record<string, string> = {};
  let model: ClusterModel = structuredClone(base);
  const rackId = 'EXAMPLE';
  if (model.racks.some((r) => r.id === rackId))
    throw new Error('The example rack ID is already in use.');
  model.racks.push({
    id: rackId,
    name: 'Example fabric equipment',
    role: 'Illustrative supporting equipment',
    units: 42,
    x: Math.max(...base.racks.map((r) => r.x)) + 1.1,
    color: '#8cafff',
    mount: '19-inch',
    depth: 1.2,
  });
  const add = (profile: string, id: string, name: string, role: string) => {
    const candidate = equipment(profile, rackId, 1, id);
    const u = firstFreeU(model, profileFor(candidate), rackId);
    if (u === null) throw new Error('The example equipment does not fit.');
    model = placeHardware(model, profile, rackId, u, id);
    const h = model.hardware.find((h) => h.id === id)!;
    h.name = name;
    roles[id] = role;
    return h;
  };
  let computes = model.hardware.filter(
    (h) => profileFor(h).category === 'compute',
  );
  if (!computes.length)
    computes = [
      add(
        base.hardware.some((h) =>
          ['sn5600', 'q3400'].includes(profileFor(h).id),
        )
          ? 'dgx-b300'
          : 'dgx-h100',
        'example-client',
        'Example client',
        'compute',
      ),
    ];
  computes.forEach((h) => {
    roles[h.id] = 'compute';
  });
  const targetSwitch = base.hardware.find(
    (h) =>
      profileFor(h).category === 'network' && profileFor(h).mount === '19-inch',
  );
  const host = profileFor(computes[0]),
    nic = host.parts.find((p) => p.key === 'nic');
  const amd = /Instinct|MI3/.test(
    host.family +
      ' ' +
      host.parts
        .filter((p) => p.kind === 'gpu')
        .map((p) => p.model)
        .join(' '),
  );
  const switchId = targetSwitch ? profileFor(targetSwitch).id : null;
  const ethernet = amd || switchId === 'sn5600';
  const rate =
    switchId === 'sn5600' ||
    switchId === 'q3400' ||
    /ConnectX-8/.test(nic?.model ?? '')
      ? 800
      : 400;
  const switchProfile = ethernet ? 'sn5600' : rate === 800 ? 'q3400' : 'qm9700';
  const computeSwitchA =
    targetSwitch && switchId !== 'sn4600c'
      ? targetSwitch
      : add(switchProfile, 'example-leaf-a', 'Example leaf A', 'leaf');
  roles[computeSwitchA.id] = 'leaf';
  const leaves = [
    computeSwitchA,
    add(switchProfile, 'example-leaf-b', 'Example leaf B', 'leaf'),
  ];
  const spines = [
    add(switchProfile, 'example-spine-a', 'Example spine A', 'spine'),
    add(switchProfile, 'example-spine-b', 'Example spine B', 'spine'),
  ];
  const frontA =
    targetSwitch && switchId === 'sn4600c'
      ? targetSwitch
      : add('sn4600c', 'example-front-a', 'Example front A', 'frontend');
  roles[frontA.id] = 'frontend';
  const front = [
    frontA,
    add('sn4600c', 'example-front-b', 'Example front B', 'frontend'),
  ];
  const storage = [
    add(
      ethernet ? 'sn5600' : 'qm9700',
      'example-storage-a',
      'Example storage A',
      'storage-switch',
    ),
    add(
      ethernet ? 'sn5600' : 'qm9700',
      'example-storage-b',
      'Example storage B',
      'storage-switch',
    ),
  ];
  const array =
    base.hardware.find((h) => profileFor(h).category === 'storage') ??
    add('ai400x2', 'example-array', 'Example flash', 'array');
  roles[array.id] = 'array';
  const connect = (
    from: Hardware,
    to: Hardware,
    fabric: Fabric,
    count: number,
    speed: number,
  ) => {
    if (count < 1) return;
    model = addConnection(model, {
      id: `example-${fabric}-${from.id}-${to.id}`,
      from: from.id,
      to: to.id,
      fabric,
      count,
      rate: speed,
    });
    const link = model.links[model.links.length - 1];
    link.label = `${count} × ${speed} ${fabric === 'frontend' || ethernet ? 'GbE' : 'Gb/s IB'} · example`;
  };
  computes.forEach((h, i) => {
    const budget = portBudget(h),
      profile = profileFor(h),
      nics = profile.parts.find((p) => p.key === 'nic')?.count ?? 0;
    // Reserve known I/O capacity when present; expansion-slot models use an explicit example allocation.
    const io = budget - nics,
      dualIO = io >= 4 || (io === 0 && budget >= 6);
    const ioPerFabric = dualIO ? 2 : 1,
      rails = Math.max(1, Math.min(nics, budget - ioPerFabric * 2));
    connect(h, leaves[0], 'compute', Math.ceil(rails / 2), rate);
    connect(h, leaves[1], 'compute', Math.floor(rails / 2), rate);
    for (let j = 0; j < ioPerFabric; j++) {
      connect(h, front[ioPerFabric === 1 ? i % 2 : j], 'frontend', 1, 100);
      connect(h, storage[ioPerFabric === 1 ? i % 2 : j], 'storage', 1, 400);
    }
  });
  for (const leaf of leaves)
    for (const spine of spines) connect(leaf, spine, 'compute', 2, rate);
  connect(front[0], front[1], 'frontend', 2, 100);
  for (const sw of storage) connect(array, sw, 'storage', 4, 200);
  const note =
    'Example network, not an OEM-certified rack configuration. Supporting equipment, adapter choices, port allocation and link rates are illustrative. Physical ports, optics, breakout modes and protocol compatibility require verification. The NVLink or xGMI scale-up domain inside the hardware is separate from these external fabrics.';
  model.description = base.description + ' ' + note;
  model.fabricExample = {
    baseHardwareIds: base.hardware.map((h) => h.id),
    roles,
    computeTransport: ethernet ? 'Ethernet' : 'InfiniBand',
    computeRate: rate,
    note,
  };
  return model;
}
