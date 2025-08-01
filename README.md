# KeyMon - SSL Guardian Collector

KeyMon is a modular, plugin-based command-line tool that extracts SSL certificate information from various sources and uploads them to your SSL Guardian dashboard for monitoring and management.

## 🔌 Plugin Architecture

KeyMon uses a **modular plugin system** that makes it easy to collect certificates from any source. Each plugin handles a specific certificate source with its own parameters and logic.

### Core Plugins
- **domain** - Live HTTPS domain scanning
- **keystore** - Java keystores (.jks, .p12, .pfx)
- **cert-folder** - Certificate file directories
- **pki-bundle** - PKI CA bundles

### Extended Plugins
- **k8s-secrets** - Kubernetes TLS secrets
- **nginx** - Nginx configuration files
- **aws-acm** - AWS Certificate Manager
- **azure-keyvault** - Azure Key Vault
- **macos-keychain** - macOS Keychain
- **postgres-tls** - PostgreSQL TLS certificates
- **windows-certstore** - Windows Certificate Store

## Features

- **🔌 Modular Plugin System** - Extensible architecture for any certificate source
- **🔄 Backward Compatibility** - Legacy syntax still works
- **🏷️ Environment Tagging** - Tag certificates with environment and group metadata
- **📊 Certificate Management** - List, filter, and delete certificates
- **⏰ Cron Job Scheduling** - Automated certificate collection
- **🔒 Secure Authentication** - Token-based authentication
- **🚀 Easy Extension** - Add new plugins without touching core code

## Prerequisites

### Required
- **Node.js** (v14 or higher)
- **OpenSSL** - For certificate file and PKI bundle parsing
- **SSL Guardian Team or Enterprise Account** - With a valid token

### Optional
- **OpenSSL** - Required only for some certificate file parsing (fallback for complex formats)

## Installation

### NPM Package (Recommended)
```bash
npm install -g keymon
keymon --list-plugins
```

### From Source
```bash
git clone https://github.com/ssl-guardian/keymon.git
cd keymon
chmod +x collectorjs
./collectorjs --list-plugins
```

## Authentication Setup

1. **Get Your Organization ID (org_id) and Token**:
   - Login to [SSL Guardian](https://app.sslguardian.io)
   - Go to Settings → Tokens
   - Get your org_id and create a new token and copy those values.

2. **Set Environment Variables** (recommended):
```bash
export SSL_GUARDIAN_TOKEN="your_token_here"
export SSL_GUARDIAN_ORG_ID="your_org_id_here"
export SSL_GUARDIAN_API_URL="https://app.sslguardian.io"  # Optional
```

## Usage

### Plugin-Based Usage (Recommended)

**Domain Scanning:**
```bash
keymon --plugin domain --domains example.com --token YOUR_TOKEN --org-id YOUR_ORG_ID
# or from source: ./collectorjs --plugin domain --domains example.com --token YOUR_TOKEN --org-id YOUR_ORG_ID
keymon --plugin domain --domains "example.com,api.example.com,www.example.com"
```

**Java Keystore:**
```bash
keymon --plugin keystore --keystores /path/to/keystore.jks --token YOUR_TOKEN --org-id YOUR_ORG_ID
keymon --plugin keystore --keystores /path/to/keystore.jks --password mypassword
```

**Certificate Folder:**
```bash
keymon --plugin cert-folder --folders /etc/ssl/certs/ --token YOUR_TOKEN --org-id YOUR_ORG_ID
```

**PKI CA Bundle:**
```bash
keymon --plugin pki-bundle --bundles /etc/ssl/internal-ca.pem \
  --environment production --group "Internal Services" --token YOUR_TOKEN --org-id YOUR_ORG_ID
```

**Kubernetes Secrets:**
```bash
keymon --plugin k8s-secrets --namespace prod --token YOUR_TOKEN --org-id YOUR_ORG_ID
keymon --plugin k8s-secrets --kubeconfig /path/to/config --namespace default
```

**Nginx Configuration:**
```bash
keymon --plugin nginx --config-path /etc/nginx/sites-enabled/ --token YOUR_TOKEN --org-id YOUR_ORG_ID
```

**AWS Certificate Manager:**
```bash
keymon --plugin aws-acm --region us-east-1 \
  --access-key-id YOUR_ACCESS_KEY --secret-access-key YOUR_SECRET_KEY \
  --token YOUR_TOKEN --org-id YOUR_ORG_ID
```

**Azure Key Vault:**
```bash
keymon --plugin azure-keyvault --vault-name myvault \
  --client-id YOUR_CLIENT_ID --client-secret YOUR_CLIENT_SECRET --tenant-id YOUR_TENANT_ID \
  --token YOUR_TOKEN --org-id YOUR_ORG_ID
```

**macOS Keychain:**
```bash
keymon --plugin macos-keychain --token YOUR_TOKEN --org-id YOUR_ORG_ID
keymon --plugin macos-keychain --keychain login.keychain
```

### Legacy Usage (Backward Compatible)

**Single Domain:**
```bash
keymon --token YOUR_TOKEN --org-id YOUR_ORG_ID --domain example.com
```

**Multiple Sources:**
```bash
keymon --token YOUR_TOKEN --org-id YOUR_ORG_ID \
  --domain example.com \
  --keystore /path/to/keystore.jks \
  --cert-folder /etc/ssl/certs/ \
  --ca-bundle /etc/ssl/ca-bundle.pem \
  --environment staging \
  --group "Web Services"
```

### Certificate Management

**List All Certificates:**
```bash
keymon --token YOUR_TOKEN --org-id YOUR_ORG_ID --list
```

**Filter by Source:**
```bash
# List only keystore certificates
keymon --token YOUR_TOKEN --org-id YOUR_ORG_ID --list --source keystore

# List only domain certificates
keymon --token YOUR_TOKEN --org-id YOUR_ORG_ID --list --source domain

# List only Kubernetes certificates
keymon --token YOUR_TOKEN --org-id YOUR_ORG_ID --list --source k8s-secrets
```

**Delete Certificate:**
```bash
keymon --token YOUR_TOKEN --org-id YOUR_ORG_ID --delete 123
```

**List Available Plugins:**
```bash
keymon --list-plugins
```

### Using Environment Variables

```bash
# Set once
export SSL_GUARDIAN_TOKEN="your_token_here"
export SSL_GUARDIAN_ORG_ID="your_org_id_here"

# Then use without --token and --org-id
keymon --plugin domain --domains example.com
keymon --plugin keystore --keystores /path/to/keystore.jks
keymon --plugin k8s-secrets --namespace prod

# Legacy syntax also works
keymon --domain example.com
keymon --keystore /path/to/keystore.jks
```

## Plugin System

### Available Plugins

| Plugin | Description | Parameters |
|--------|-------------|------------|
| `domain` | Live HTTPS domain scanning | `domains` (required) |
| `keystore` | Java keystores (.jks, .p12, .pfx) | `keystores` (required), `password` (optional) |
| `cert-folder` | Certificate file directories | `folders` (required) |
| `pki-bundle` | PKI CA bundles | `bundles` (required) |
| `k8s-secrets` | Kubernetes TLS secrets | `kubeconfig` (optional), `namespace` (optional) |
| `nginx` | Nginx configuration files | `config-path` (required) |
| `aws-acm` | AWS Certificate Manager | `access-key-id`, `secret-access-key` (required), `region` (optional) |
| `azure-keyvault` | Azure Key Vault | `vault-name`, `client-id`, `client-secret`, `tenant-id` (all required) |
| `macos-keychain` | macOS Keychain | `keychain` (optional) |
| `postgres-tls` | PostgreSQL TLS certificates | `data-dir`, `cert-file`, `key-file` (all optional) |
| `windows-certstore` | Windows Certificate Store | `store` (optional), `location` (optional) |

### Core Options

| Option | Description | Required | Example |
|--------|-------------|----------|---------|  
| `--plugin PLUGIN` | Use specific plugin | Yes* | `--plugin domain` |
| `--token TOKEN` | SSL Guardian authentication token | Yes** | `--token abc123...` |
| `--org-id ORG_ID` | Organization ID | Yes** | `--org-id uuid-here` |
| `--environment ENV` | Environment tag for certificates | No | `--environment production` |
| `--group GROUP` | Group tag for certificates | No | `--group "Web Services"` |
| `--list` | List all certificates with status | No* | `--list` |
| `--delete ID` | Delete certificate by ID | No* | `--delete 123` |
| `--list-plugins` | List available plugins | No* | `--list-plugins` |

*One of plugin, list, delete, or list-plugins is required  
**Required unless set via environment variables

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SSL_GUARDIAN_TOKEN` | Authentication token | None |
| `SSL_GUARDIAN_ORG_ID` | Organization ID | None |
| `SSL_GUARDIAN_API_URL` | API endpoint | `https://app.sslguardian.io` |
| `KEYSTORE_PASSWORD` | Keystore password | `changeit` |

## Plugin Details

### Core Plugins

#### domain
- **Purpose**: Live HTTPS domain scanning
- **Protocols**: HTTPS/TLS connections
- **Ports**: Default 443, custom ports supported (`example.com:8443`)
- **Usage**: `--plugin domain --domains "example.com,api.example.com"`

#### keystore  
- **Purpose**: Java keystores (.jks, .p12, .pfx)
- **Tool**: Native Node.js parsing (no Java required)
- **Authentication**: Password-based (default: `changeit`)
- **Usage**: `--plugin keystore --keystores /path/to/store.jks --password mypass`

#### cert-folder
- **Purpose**: Certificate file directories
- **Formats**: PEM, CRT, CER, CERT, P7B, P7C
- **Tool**: OpenSSL for parsing
- **Usage**: `--plugin cert-folder --folders /etc/ssl/certs/`

#### pki-bundle
- **Purpose**: PKI CA bundles
- **Format**: Multi-certificate PEM bundles
- **Tool**: OpenSSL for parsing
- **Usage**: `--plugin pki-bundle --bundles /etc/ssl/ca-bundle.pem`

### Extended Plugins

#### k8s-secrets
- **Purpose**: Kubernetes TLS secrets
- **Requirements**: Kubeconfig file access
- **Usage**: `--plugin k8s-secrets --namespace prod --kubeconfig /path/to/config`

#### nginx
- **Purpose**: Nginx configuration files
- **Requirements**: Access to Nginx config files
- **Usage**: `--plugin nginx --config-path /etc/nginx/sites-enabled/`

#### aws-acm
- **Purpose**: AWS Certificate Manager
- **Requirements**: AWS access keys
- **Usage**: `--plugin aws-acm --region us-east-1 --access-key-id xxx --secret-access-key xxx`

#### azure-keyvault
- **Purpose**: Azure Key Vault
- **Requirements**: Azure service principal credentials
- **Usage**: `--plugin azure-keyvault --vault-name myvault --client-id xxx --client-secret xxx --tenant-id xxx`

#### macos-keychain
- **Purpose**: macOS Keychain
- **Requirements**: macOS system
- **Usage**: `--plugin macos-keychain --keychain System.keychain`

#### postgres-tls
- **Purpose**: PostgreSQL TLS certificates
- **Requirements**: Access to PostgreSQL cert files
- **Usage**: `--plugin postgres-tls --data-dir /var/lib/postgresql/data`

#### windows-certstore
- **Purpose**: Windows Certificate Store
- **Requirements**: Windows system with PowerShell
- **Usage**: `--plugin windows-certstore --store My --location CurrentUser`

## Output Examples

### Certificate Collection
```
Fetching certificate info for: example.com
✓ Successfully fetched certificate for example.com
Extracting certificate info from keystore: /path/to/keystore.jks
✓ Successfully extracted 3 certificates from /path/to/keystore.jks
Scanning certificate folder: /etc/ssl/certs/
✓ Parsed certificate: internal.example.com
✓ Successfully scanned 1 certificates from /etc/ssl/certs/
Parsing PKI CA bundle: /etc/ssl/ca-bundle.pem
✓ Parsed PKI certificate: Internal Root CA
✓ Parsed PKI certificate: Internal Intermediate CA
✓ Successfully parsed 2 certificates from PKI bundle /etc/ssl/ca-bundle.pem
Submitting 6 certificates to SSL Guardian...
Submission results:
✓ Created: 4
✓ Updated: 2
✗ Errors: 0
```

### Certificate Listing
```
Found 8 certificates:

ID      Domain                  Status    Days  Source    Issuer
──────────────────────────────────────────────────────────────────────────────────
123     example.com             🟢 valid     45   domain    Let's Encrypt
124     api.example.com         🟡 warning   25   domain    Let's Encrypt  
125     internal.corp.com       🟢 valid     180  keystore  Internal CA
126     Root CA                 🟢 valid     3650 pki       Self-signed
127     old.example.com         🔴 expired   -5   file      DigiCert
```

### Filtered Listing
```
Found 2 certificates (filtered by source: keystore):

ID      Domain                  Status    Days  Source    Issuer
──────────────────────────────────────────────────────────────────────────────────
125     internal.corp.com       🟢 valid     180  keystore  Internal CA
128     app.internal.com        🟡 warning   15   keystore  Internal CA
```

## Certificate Metadata and Tagging

### Automatic Tags
All certificates are automatically tagged with:
- **source** - Origin type (domain, keystore, file, pki)
- **environment** - Environment specified with `--environment`
- **group** - Group specified with `--group`

### Source-Specific Tags
- **Domain**: Connection details
- **Keystore**: File path, alias information
- **File**: File path, filename
- **PKI**: Bundle path, certificate index

### Tag Examples
```json
{
  "source": "pki",
  "environment": "production",
  "group": "Internal Services",
  "bundle_path": "/etc/ssl/ca-bundle.pem",
  "bundle_index": 0
}
```

## Cron Job Scheduling

### Install Automated Collection

**Every 6 hours with domain plugin:**
```bash
keymon --plugin domain --domains example.com --cron "0 */6 * * *" --install-cron
```

**Daily at midnight with Kubernetes:**
```bash
keymon --plugin k8s-secrets --namespace prod \
  --environment production --cron "0 0 * * *" --cron-name "daily-k8s-check" --install-cron
```

**Weekly AWS ACM check:**
```bash
keymon --plugin aws-acm --region us-east-1 --cron "0 0 * * 0" \
  --cron-name "weekly-acm-check" --install-cron
```

**Legacy syntax (still works):**
```bash
keymon --domain example.com --keystore /path/to/keystore.jks \
  --environment production --cron "0 0 * * *" --cron-name "daily-ssl-check" --install-cron
```

### Manage Cron Jobs

**List all SSL Guardian cron jobs:**
```bash
keymon --list-cron
```

**Remove specific cron job:**
```bash
keymon --cron-name "daily-ssl-check" --remove-cron
```

### Common Cron Schedules

| Schedule | Description | Example Use Case |
|----------|-------------|------------------|
| `0 */6 * * *` | Every 6 hours | High-frequency monitoring |
| `0 0 * * *` | Daily at midnight | Standard daily checks |
| `0 0 * * 0` | Weekly on Sunday | Weekly PKI updates |
| `0 0 1 * *` | Monthly on 1st | Monthly compliance checks |
| `0 2 * * 1-5` | Weekdays at 2 AM | Business day monitoring |

## Advanced Usage

### Plugin-Based Workflows

**Multi-Environment Collection:**
```bash
# Development environment
keymon --plugin domain --domains dev.example.com \
  --environment development --group "Dev Services"

# Production Kubernetes
keymon --plugin k8s-secrets --namespace prod \
  --environment production --group "Production Services"

# AWS Production
keymon --plugin aws-acm --region us-east-1 \
  --environment production --group "AWS Services"
```

**Infrastructure-Specific Collection:**
```bash
# Web servers (Nginx)
keymon --plugin nginx --config-path /etc/nginx/sites-enabled/ \
  --environment production --group "Web Servers"

# Database servers (PostgreSQL)
keymon --plugin postgres-tls --data-dir /var/lib/postgresql/data \
  --environment production --group "Database Servers"

# Container orchestration (Kubernetes)
keymon --plugin k8s-secrets --namespace default \
  --environment production --group "Container Platform"
```

**Certificate Management Workflow:**
```bash
# 1. List available plugins
keymon --list-plugins

# 2. Collect certificates from specific source
keymon --plugin k8s-secrets --namespace prod

# 3. List and review
keymon --list

# 4. Filter by plugin source
keymon --list --source k8s-secrets

# 5. Remove unwanted certificates
keymon --delete 123
```

**Legacy Batch Processing (still works):**
```bash
keymon --token TOKEN --org-id ORG_ID \
  --domain api.example.com \
  --keystore /opt/app/keystore.jks \
  --cert-folder /etc/ssl/certs/ \
  --ca-bundle /etc/ssl/internal-ca.pem \
  --environment production \
  --group "Production Services"
```

## API Integration

KeyMon integrates with SSL Guardian's REST API. All plugins submit certificates using the same API endpoints:

### Submit Certificates
```bash
curl -X POST "https://app.sslguardian.io/v1/collector/submit" \
  -H "Content-Type: application/json" \
  -H "token: YOUR_TOKEN" \
  -H "org-id: YOUR_ORG_ID" \
  -d '{
    "certificates": [
      {
        "domain": "example.com",
        "issuer": "Let'\''s Encrypt",
        "expiration_date": "2024-12-31T23:59:59Z",
        "tags": { 
          "source": "domain",
          "environment": "production",
          "group": "Web Services"
        }
      }
    ]
  }'
```

### List Certificates
```bash
curl -X GET "https://app.sslguardian.io/v1/collector/certificates" \
  -H "token: YOUR_TOKEN" \
  -H "org-id: YOUR_ORG_ID"
```

### Delete Certificate
```bash
curl -X DELETE "https://app.sslguardian.io/v1/collector/certificates/CERT_ID" \
  -H "token: YOUR_TOKEN" \
  -H "org-id: YOUR_ORG_ID"
```

## Creating Custom Plugins

KeyMon's plugin system makes it easy to add support for new certificate sources:

```javascript
const BasePlugin = require('../lib/base-plugin');

class MyPlugin extends BasePlugin {
  constructor() {
    super();
    this.name = 'my-plugin';
    this.description = 'My custom certificate source';
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
      environment: config.environment,
      group: config.group,
      tags: { custom_tag: 'value' }
    }));
    
    return certificates;
  }
}

module.exports = MyPlugin;
```

Save as `plugins/my-plugin.js` and use with:
```bash
keymon --plugin my-plugin --param1 value
```

## Troubleshooting

### Plugin-Specific Issues

**Plugin not found:**
```bash
# List available plugins
keymon --list-plugins

# Check plugin file exists (from source)
ls plugins/
```

**Plugin parameter errors:**
```bash
# Check plugin help
keymon --help

# Verify required parameters are provided
keymon --plugin domain --domains example.com
```

### Common Issues by Plugin

**keystore plugin:**
- No Java installation required (uses native Node.js parsing)
- Set KEYSTORE_PASSWORD environment variable if needed
- Supports .jks, .p12, and .pfx formats

**k8s-secrets plugin:**
- Ensure kubeconfig file is accessible
- Verify cluster connectivity and secret read permissions
- No kubectl installation required

**aws-acm plugin:**
- Create AWS IAM user with ACM read permissions
- Use access-key-id and secret-access-key parameters
- Verify ACM permissions in target region

**azure-keyvault plugin:**
- Create Azure service principal with Key Vault access
- Ensure service principal has 'Certificate User' role on Key Vault
- Verify client-id, client-secret, and tenant-id are correct

**nginx plugin:**
- Ensure access to Nginx configuration files
- Verify certificate file paths in configs

**cert-folder/pki-bundle plugins:**
- Install OpenSSL: `brew install openssl` (macOS) or `apt-get install openssl` (Ubuntu)
- Verify file paths and permissions

**General issues:**
- **"Invalid token"**: Verify token and org-id are correct
- **"Connection timeout"**: Check network connectivity and firewall settings
- **"No certificates found"**: Verify source accessibility and parameters

### Debug Mode

Add verbose logging by modifying the script or contact support for assistance.

## Security Notes

- **Secure Transmission** - All data transmitted over HTTPS with token authentication
- **Local Processing** - Certificates processed locally before upload
- **No Private Keys** - Only public certificate data is extracted and transmitted
- **Metadata Only** - Certificate metadata, fingerprints, and expiration data uploaded
- **Token Security** - Use secure token storage and rotation practices
- **File Permissions** - Ensure certificate files have appropriate access controls
- **Temporary Files** - Temporary files are automatically cleaned up after processing

## CLI Reference

### Exit Codes
- **0** - Success
- **1** - General error (missing arguments, file not found, etc.)
- **2** - Authentication error
- **3** - Network/API error

### Status Indicators
- 🟢 **valid** - More than 30 days remaining
- 🟡 **warning** - 8-30 days remaining  
- 🟠 **critical** - 1-7 days remaining
- 🔴 **expired** - Past expiration date

### Source Types
- **domain** - Live domain certificate
- **keystore** - Java keystore certificate
- **file** - Certificate file
- **pki** - PKI CA bundle certificate

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for detailed release notes and version history.

## Support

- **Documentation**: [SSL Guardian Docs](https://docs.sslguardian.io)
- **Support**: [support@sslguardian.io](mailto:support@sslguardian.io)
- **Issues**: Report via SSL Guardian dashboard

## Contributing

We welcome contributions! To add a new plugin:

1. Create a new plugin file in `plugins/`
2. Extend the `BasePlugin` class
3. Implement the `collect()` method
4. Test your plugin
5. Submit a pull request

See `PLUGINS.md` for detailed plugin development guide.

## License

Copyright © 2024 SSL Guardian. All rights reserved.