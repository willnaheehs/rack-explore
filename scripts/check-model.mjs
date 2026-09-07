import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { importInfrastructure } from '../lib/infrastructure-adapter.ts';
import { validateInfrastructure } from '../lib/infrastructure.ts';

const files = process.argv.slice(2);
if (!files.length)
  files.push(
    ...['small-cpu-plan', 'lumi-public-record'].map((name) =>
      fileURLToPath(
        new URL(
          `../public/models/${name}.physical-compute.json`,
          import.meta.url,
        ),
      ),
    ),
  );
for (const path of files) {
  try {
    const doc = importInfrastructure(await readFile(path, 'utf8'));
    const issues = validateInfrastructure(doc);
    console.log(
      `${doc.title}: valid structure · ${doc.assets.length} asset records · ${doc.connections.length} connections`,
    );
    for (const issue of issues)
      console.log(`  ${issue.level}: ${issue.message}`);
  } catch (error) {
    console.error(
      `${path}: ${error instanceof Error ? error.message : 'Invalid model'}`,
    );
    process.exitCode = 1;
  }
}
