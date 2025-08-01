# KeyMon Plugin System

KeyMon supports a modular plugin architecture for collecting certificates from various sources.

## Available Plugins

### Core Plugins

### domain
Fetch certificates from live HTTPS domains.

```bash
./collectorjs --plugin domain --domains google.com
./collectorjs --plugin domain --domains "google.com,github.com,stackoverflow.com"
# Legacy compatibility
./collectorjs --domain google.com
```

**Parameters:**
- `domains` - Comma-separated list of domains (required)

### keystore
Extract certificates from Java keystores (.jks, .p12, .pfx).

```bash
./collectorjs --plugin keystore --keystores /path/to/store.jks
./collectorjs --plugin keystore --keystores /path/to/store.jks --password mypass
# Legacy compatibility
./collectorjs --keystore /path/to/store.jks
```

**Parameters:**
- `keystores` - Comma-separated list of keystore paths (required)
- `password` - Keystore password (optional, default: changeit)

**Requirements:**
- No Java installation required (uses native Node.js parsing)
- Supports .jks, .p12, and .pfx formats

### cert-folder
Parse certificate files from directories.

```bash
./collectorjs --plugin cert-folder --folders /etc/ssl/certs/
./collectorjs --plugin cert-folder --folders "/etc/ssl/certs/,/opt/certs/"
# Legacy compatibility
./collectorjs --cert-folder /etc/ssl/certs/
```

**Parameters:**
- `folders` - Comma-separated list of folder paths (required)

### pki-bundle
Parse multi-certificate CA bundles.

```bash
./collectorjs --plugin pki-bundle --bundles /etc/ssl/ca-bundle.pem
./collectorjs --plugin pki-bundle --bundles "/etc/ssl/ca.pem,/opt/ca-bundle.pem"
# Legacy compatibility
./collectorjs --ca-bundle /etc/ssl/ca-bundle.pem
```

**Parameters:**
- `bundles` - Comma-separated list of bundle file paths (required)

### Extended Plugins

### k8s-secrets
Extract certificates from Kubernetes TLS secrets.

```bash
./collectorjs --plugin k8s-secrets --kubeconfig /path/to/config --namespace prod
./collectorjs --plugin k8s-secrets --namespace default
./collectorjs --plugin k8s-secrets  # All namespaces
```

**Parameters:**
- `kubeconfig` - Path to kubeconfig file (optional)
- `namespace` - Specific namespace (optional, default: all namespaces)

**Requirements:**
- Kubeconfig file with cluster access
- No kubectl installation required (uses Kubernetes REST API)

### nginx
Extract certificates from Nginx configuration files.

```bash
./collectorjs --plugin nginx --config-path /etc/nginx/sites-enabled/
./collectorjs --plugin nginx --config-path /etc/nginx/nginx.conf
```

**Parameters:**
- `config-path` - Path to Nginx config file or directory (required)

### aws-acm
Extract certificates from AWS Certificate Manager.

```bash
./collectorjs --plugin aws-acm --region us-east-1 \
  --access-key-id YOUR_ACCESS_KEY --secret-access-key YOUR_SECRET_KEY
```

**Parameters:**
- `access-key-id` - AWS access key ID (required)
- `secret-access-key` - AWS secret access key (required)
- `region` - AWS region (optional, default: us-east-1)

### azure-keyvault
Extract certificates from Azure Key Vault.

```bash
./collectorjs --plugin azure-keyvault --vault-name myvault \
  --client-id YOUR_CLIENT_ID --client-secret YOUR_CLIENT_SECRET --tenant-id YOUR_TENANT_ID
```

**Parameters:**
- `vault-name` - Azure Key Vault name (required)
- `client-id` - Azure service principal client ID (required)
- `client-secret` - Azure service principal client secret (required)
- `tenant-id` - Azure tenant ID (required)

### macos-keychain
Extract certificates from macOS Keychain.

```bash
./collectorjs --plugin macos-keychain
./collectorjs --plugin macos-keychain --keychain login.keychain
```

**Parameters:**
- `keychain` - Keychain name (optional, default: System.keychain)

### postgres-tls
Extract TLS certificates from PostgreSQL configuration.

```bash
./collectorjs --plugin postgres-tls
./collectorjs --plugin postgres-tls --data-dir /var/lib/postgresql/data
./collectorjs --plugin postgres-tls --cert-file /path/to/server.crt
```

**Parameters:**
- `data-dir` - PostgreSQL data directory (optional)
- `cert-file` - Path to certificate file (optional)
- `key-file` - Path to key file (optional)

### windows-certstore
Extract certificates from Windows Certificate Store (Windows only).

```bash
./collectorjs --plugin windows-certstore
./collectorjs --plugin windows-certstore --store Root --location LocalMachine
```

**Parameters:**
- `store` - Certificate store name (optional, default: My)
- `location` - Store location (optional, default: CurrentUser)

## Creating Custom Plugins

1. Create a new file in the `plugins/` directory
2. Extend the `BasePlugin` class
3. Implement the required methods

```javascript
const BasePlugin = require('../lib/base-plugin');

class MyPlugin extends BasePlugin {
  constructor() {
    super();
    this.name = 'my-plugin';
    this.description = 'My custom plugin';
    this.requiredParams = ['param1'];
  }

  async collect(config) {
    this.validateConfig(config);
    
    // Your collection logic here
    const certificates = [];
    
    // Use this.createCertificate() to create certificate objects
    certificates.push(this.createCertificate({
      domain: 'example.com',
      issuer: 'My CA',
      expiration_date: new Date(),
      valid_from: new Date(),
      // ... other certificate data
      environment: config.environment,
      group: config.group,
      tags: {
        custom_tag: 'value'
      }
    }));
    
    return certificates;
  }
}

module.exports = MyPlugin;
```

## Plugin Management

List available plugins:
```bash
./collectorjs --list-plugins
```

Use with environment and group tags:
```bash
./collectorjs --plugin k8s-secrets --environment production --group web-services
```

## Requirements

Each plugin may have specific requirements:
- **domain**: No additional requirements
- **keystore**: No Java installation required (native Node.js parsing)
- **cert-folder**: OpenSSL for certificate parsing
- **pki-bundle**: OpenSSL for certificate parsing
- **k8s-secrets**: Kubeconfig file access (no kubectl needed)
- **nginx**: Access to Nginx config files + OpenSSL
- **aws-acm**: AWS access keys (no AWS CLI needed)
- **azure-keyvault**: Azure service principal credentials (no Azure CLI needed)
- **macos-keychain**: macOS system
- **postgres-tls**: Access to PostgreSQL cert files + OpenSSL
- **windows-certstore**: Windows system with PowerShell