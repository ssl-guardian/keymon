# Publishing KeyMon to NPM

## Prerequisites

1. **NPM Account**: Create account at [npmjs.com](https://www.npmjs.com)
2. **NPM CLI**: Ensure npm is installed and updated
3. **Authentication**: Login to npm from command line

## Steps to Publish

### 1. Login to NPM
```bash
npm login
# Enter your npm username, password, and email
```

### 2. Verify Package
```bash
# Test package creation
npm pack

# Check package contents
tar -tzf keymon-1.0.0.tgz
```

### 3. Test Installation Locally
```bash
# Install from local package
npm install -g ./keymon-1.0.0.tgz

# Test the command
keymon --list-plugins

# Uninstall test version
npm uninstall -g keymon
```

### 4. Publish to NPM
```bash
# Publish to npm registry
npm publish

# For scoped packages (if needed)
npm publish --access public
```

### 5. Verify Publication
```bash
# Check if package is available
npm view keymon

# Test global installation
npm install -g keymon
keymon --list-plugins
```

## Version Management

### Update Version
```bash
# Patch version (1.0.0 -> 1.0.1)
npm version patch

# Minor version (1.0.0 -> 1.1.0)
npm version minor

# Major version (1.0.0 -> 2.0.0)
npm version major
```

### Publish Updates
```bash
npm publish
```

## Package Information

- **Package Name**: `keymon`
- **Current Version**: `1.0.0`
- **Binary Command**: `keymon`
- **Package Size**: ~13.4 kB
- **Unpacked Size**: ~66.1 kB

## Post-Publication

1. **Update README**: Add NPM badge and installation instructions
2. **GitHub Release**: Create corresponding GitHub release
3. **Documentation**: Update any external documentation
4. **Announcement**: Announce on relevant channels

## Troubleshooting

**Package name taken:**
```bash
# Check if name is available
npm view keymon

# Use scoped package if needed
# Update package.json name to "@your-org/keymon"
```

**Permission errors:**
```bash
# Verify npm login
npm whoami

# Check package permissions
npm owner ls keymon
```

**Version conflicts:**
```bash
# Check current published version
npm view keymon version

# Update version in package.json
npm version patch
```