# Release Checklist

- npm install
- npm run build
- npm test
- npm pack --dry-run
- inspect tarball for dist/src, schemas, README, LICENSE, package.json
- npm publish --access public
- git tag v1.2.0
- git push origin v1.2.0
