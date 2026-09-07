import { mkdir, writeFile } from 'node:fs/promises';
import {
  smallCpuExample,
  lumiExample,
} from '../lib/infrastructure-examples.ts';
import { exportInfrastructure } from '../lib/infrastructure.ts';

const directory = new URL('../public/models/', import.meta.url);
await mkdir(directory, { recursive: true });
for (const doc of [smallCpuExample(), lumiExample()]) {
  await writeFile(
    new URL(`${doc.id}.physical-compute.json`, directory),
    exportInfrastructure(doc),
  );
  console.log(`Wrote ${doc.id}.physical-compute.json`);
}
