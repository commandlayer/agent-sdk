import { copyFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';

const sourceDir = 'src';
const destinationDir = path.join('dist', 'src');
const schemaPattern = /^schemas\.trust-.*\.json$/;

await mkdir(destinationDir, { recursive: true });

const sourceEntries = await readdir(sourceDir, { withFileTypes: true });
const schemaFiles = sourceEntries
  .filter((entry) => entry.isFile() && schemaPattern.test(entry.name))
  .map((entry) => entry.name);

await Promise.all(
  schemaFiles.map((fileName) =>
    copyFile(path.join(sourceDir, fileName), path.join(destinationDir, fileName)),
  ),
);
