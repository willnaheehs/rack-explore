# Washington cluster: network information request

We now know the 32 nodes use eight ConnectX-8 800 GbE RoCE v2 compute
adapters and two single-port ConnectX-7 400 GbE storage adapters per node,
plus a 150 TB WEKA service. The expanded sheet also supplies the 8U air-cooled
chassis, 24 DIMMs and GPU details. The main missing inputs are **switch
inventory and port-to-port wiring**.

## Minimum needed to draw the installed network

1. **Switch inventory:** device names, manufacturers, exact models, quantities,
   network roles, racks and U positions where available.
2. **Server adapters:** confirm configured ConnectX-8 port/breakout mode and
   whether all 32 servers share the supplied configuration. Models and adapter
   counts are now supplied.
3. **Connections:** an as-built diagram or cable schedule showing both endpoint
   devices and port labels, including server-to-switch and switch-to-switch
   connections. LLDP neighbor exports can help reconstruct this information.
4. **WEKA attachment:** dedicated storage servers versus software on the GPU
   nodes, backend server/NIC inventory, and which switches and ports connect
   storage. Confirm whether its 150 TB capacity is raw or usable.

A vendor quote or bill of materials and a diagram are a useful starting point.
Mark each document as installed, planned, or recommended, with its date.
An anonymized inventory is fine if identifiers stay consistent between files.

Suggested cable schedule columns:

```csv
from_device,from_port,to_device,to_port,configured_speed_gbps,network_role,breakout_mode,cable_or_optic,source_date
```

## Additional detail for the RoCE view

- GPU-to-NIC and CPU/PCIe affinity for one representative server of each
  configuration, with exceptions identified. `nvidia-smi topo -m` provides
  topology context; it does not establish external switch cabling or prove
  traffic uses a particular path. See the [NVIDIA SMI documentation](https://docs.nvidia.com/deploy/nvidia-smi/index.html).
- NIC firmware/driver and switch operating-system versions.
- VLANs/subnets, MTU, routing, ECMP or other multipath configuration, and any
  separate rails or network planes.
- RoCE traffic classification: DSCP/priority mappings, PFC enabled/disabled and
  priorities, ECN marking, and the configured congestion-control mechanism.
  See [NVIDIA's NIC configuration fields](https://docs.nvidia.com/networking/display/kubernetes2670/nic-conf-operator/configuration-details.html)
  for examples of the settings involved; no particular vendor profile is
  assumed for this cluster.
- Whether compute, storage, user access and management share physical links
  or use distinct switches/ports.

For an eventual live behavior view, add timestamped counters: utilization,
errors/discards, ECN/CNP and PFC counters, plus representative throughput and
latency measurements. These are optional for a static as-built topology.

## Request to forward to the operator

> Could you share the as-built network diagram and network bill of materials
> for the 32-node B300 cluster, including NIC models and port speeds per node,
> switch models/counts, server-to-switch and switch-to-switch port mappings,
> and how the 150 TB WEKA service connects? If available, please also include
> GPU-to-NIC topology for a representative node and the relevant RoCE, MTU,
> VLAN/routing, PFC and ECN configuration. Please identify any planned or
> recommended settings separately from what is installed. Sanitized exports
> are sufficient; credentials are not needed.
