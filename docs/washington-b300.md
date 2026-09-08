# Washington B300 cluster

Catalog ID: `washington-b300`. User-supplied specifications recorded and expanded
8 September 2026. This is a reported configuration, not an independently
surveyed installation. The cluster contains **32 nodes** and **150 TB WEKA**.

| Item              | Supplied per-node configuration                                          |
| ----------------- | ------------------------------------------------------------------------ |
| Chassis           | 8U dual-socket AMD EPYC HGX, air-cooled; OEM SKU not supplied            |
| GPUs              | 8 × NVIDIA B300 SXM, Blackwell Ultra                                     |
| GPU memory        | 288 GB HBM3e each; 2.304 TB per node                                     |
| CPU               | 2 × AMD EPYC 9555, 64 cores each, Zen 5                                  |
| NVLink            | Fifth generation, 1.8 TB/s bidirectional per GPU                         |
| Host RAM          | 24 × 96 GB DDR5-6400 ECC RDIMM; 2.304 TB                                 |
| Local data drives | 8 × 3.84 TB U.2 NVMe Gen5; 30.72 TB raw                                  |
| Boot drives       | Earlier sheet: 2 × 1.92 TB RAID-1; expanded sheet: “3.84 TB boot RAID-1” |
| Compute network   | 8 × NVIDIA ConnectX-8 SuperNIC, 800 GbE with RoCE v2; 6.4 Tb/s aggregate |
| Storage network   | 2 × NVIDIA ConnectX-7, single-port 400 GbE                               |
| Location          | Washington, US; facility and operator not supplied                       |

The expanded sheet explicitly distinguishes **host DDR5 RAM from GPU HBM**;
this supersedes the earlier memory-pool ambiguity. It also establishes 8U
height, air cooling, DIMM population, U.2 Gen5 data drives and adapter models.

## Totals and interpretation

- 256 GPUs, 64 CPUs, 4,096 CPU cores and 768 host DIMMs.
- 73.728 TB host DDR5 and a separate 73.728 TB GPU HBM pool.
- 256 ConnectX-8 compute adapters and 64 ConnectX-7 storage adapters.
- Compute: 204.8 Tb/s summed endpoint rates; storage: 25.6 Tb/s summed endpoint
  rates. Neither number is measured throughput or network bisection bandwidth.
- Local data: 983.04 TB raw. Protection and usable capacity are unspecified.
- WEKA: 150 TB shared; raw versus usable and dedicated versus converged
  deployment are unspecified. Whether local drives back WEKA is unknown,
  so their capacities must not be added together.
- Boot: the original 2 × 1.92 TB mirror gives 3.84 TB raw and 1.92 TB usable
  before overhead. The expanded sheet does not establish whether its 3.84 TB
  figure instead means usable capacity. The model retains the original drive
  pair and explicitly asks for this clarification.

## Geometry and network boundaries

Eight display racks with four nodes each are an illustrative arrangement.
Chassis depth is drawn as 0.9 m; actual OEM dimensions, rack count, U locations,
mounting details, cooling airflow, fan/PSU inventory and power limits remain
unknown. The power view uses an editable 15 kW/node planning allowance.

The network views show every adapter on one representative node. Selecting an
adapter opens its hardware inspector. Lines show logical attachments and
capacity boundaries until the installed switching and cable map is supplied.
No GPU-to-NIC pairing, switch quantity, destination port, or external physical
cable is inferred. Compute and storage have separate adapter budgets; using
an adapter in a custom plan does not qualify its port/breakout mode or optics.

WEKA is represented as a storage service rather than an invented appliance.
Its backend server, board, drive and network inventories remain unknown.

## Component context and next inputs

- [AMD EPYC 9555](https://www.amd.com/en/products/processors/server/epyc/9005-series/amd-epyc-9555.html): processor specifications.
- [NVIDIA HGX B300](https://docs.nvidia.com/enterprise-reference-architectures/hgx-ai-factory/latest/components.html): GPU, memory and NVLink context; not an OEM installation certificate.
- [WEKA architecture](https://www.weka.io/resources/white-paper/wekaio-architectural-whitepaper): deployment models, not this service's installed backend inventory.

See [the operator information request](network-inventory-request.md) for the
remaining switch, cable map, RoCE configuration and WEKA connection details.
