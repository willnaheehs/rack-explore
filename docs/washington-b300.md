# Washington B300 cluster

Recorded 8 September 2026. Catalog ID: `washington-b300`.

This is a user-supplied configuration, not an independently verified deployment
or an OEM reference rack. “Washington B300 cluster” is a descriptive name;
the operator, facility and chassis manufacturer were not provided.

## Supplied information

The source image was titled “4. Per-Unit Hardware Profile”:

| Component         | Supplied specification per node     |
| ----------------- | ----------------------------------- |
| GPU / accelerator | 8× B300 GPUs                        |
| CPU               | 2× AMD EPYC 9555 (128 cores total)  |
| System memory     | 2.3 TB                              |
| Boot storage      | 2× 1.92 TB RAID-1 (3.84 TB total)   |
| Data storage      | 8× 3.84 TB NVMe SSD (30.7 TB total) |
| Interconnect      | 6.4 Tbps RoCE v2                    |
| Location          | Washington, US                      |

The user clarified: **32 nodes, with 150 TB WEKA**. WEKA capacity is recorded
once for the cluster, not once per node.

## Derived totals and interpretation

- 32 × 8 = **256 B300 GPUs**.
- 32 × 2 = **64 EPYC 9555 CPUs**, or **4,096 physical CPU cores**.
- Boot: **3.84 TB raw per node**, **1.92 TB usable under RAID-1 before
  overhead**. Across 32 independent mirrors this is 122.88 TB raw / 61.44 TB
  usable, not a shared filesystem.
- Local data: **30.72 TB raw per node**, **983.04 TB raw cluster-wide**.
  RAID / erasure coding and usable local capacity were not given.
- The supplied 2.3 TB “system memory” label is preserved, with a confirmation
  flag. It also matches the nominal aggregate HBM capacity of eight B300 GPUs;
  host DDR5 and GPU HBM must not be conflated. No DIMM population is inferred.
- 6.4 Tb/s is an aggregate per-node RoCE v2 rate. Multiplying by 32 gives
  204.8 Tb/s of summed endpoint rates, **not** measured throughput or fabric
  bisection bandwidth. No per-port speed, adapter model or switch is inferred.
- 150 TB WEKA is a shared service. Raw/usable basis, protection, dedicated or
  converged deployment and backend hardware are unknown. Its capacity is not
  added to local NVMe because the relationship between the pools is unknown.

## Display assumptions

The physical view arranges the 32 nodes in **eight illustrative 42U racks**, with
four generic 8U, 0.9 m deep server envelopes in each. Actual rack count,
dimensions, U positions, mounting, weight and cooling are unknown. This is a
navigation layout, not a validated installation drawing or fit recommendation.

GPUs, CPUs and drives use supplied per-node populations. Memory, network, host
board, GPU board and storage connectivity use representative functional blocks.
Their geometry and block counts are not a board layout or bill of materials.
No installed fan, PSU, NVSwitch, NIC or DIMM count is fabricated.

WEKA is inspectable as a service in the Storage fabric and Infrastructure views.
There is no invented storage appliance. Network lines are capabilities or
logical associations; no physical cables are created. The front-end network
remains unspecified. The Power view uses an editable **15 kW/node planning
allowance**, not a measurement, validated maximum or PSU rating. It excludes
unknown storage/network equipment and does not validate rack power or cooling.

## Component context

- [AMD EPYC 9555 specifications](https://www.amd.com/en/products/processors/server/epyc/9005-series/amd-epyc-9555.html)
  establish 64 cores per processor.
- [NVIDIA HGX B300 components](https://docs.nvidia.com/enterprise-reference-architectures/hgx-ai-factory/latest/components.html)
  give nominal 288 GB HBM3e per B300 GPU and NVLink platform context. These
  component references do not verify the supplied cluster’s OEM build.
- [WEKA architecture](https://www.weka.io/resources/white-paper/wekaio-architectural-whitepaper)
  describes software-defined storage and dedicated/converged deployment models;
  it does not identify this cluster’s backend hardware.

To replace the remaining assumptions, obtain the OEM chassis SKU and BoM,
rack elevations, host DIMM population, adapter/switch/port and cable inventory,
WEKA backend inventory and usable-capacity report, and electrical/cooling data.
