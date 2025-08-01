# Changelog

All notable changes to KeyMon will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2024-07-31

### Added
- **Azure Key Vault Plugin** - Extract certificates from Azure Key Vault using REST API
- **API-Based Architecture** - Converted CLI-dependent plugins to use native APIs
- **Enhanced Authentication** - Direct API authentication without CLI dependencies

### Changed
- **AWS ACM Plugin** - Now uses AWS REST API instead of AWS CLI
  - Requires `access-key-id` and `secret-access-key` parameters
  - No longer requires AWS CLI installation
- **Kubernetes Plugin** - Now uses Kubernetes REST API instead of kubectl
  - Reads kubeconfig directly, no kubectl installation needed
- **Keystore Plugin** - Now uses native Node.js parsing instead of Java keytool
  - No longer requires Java JDK installation
  - Supports .jks, .p12, .pfx formats natively
- **Azure Key Vault Plugin** - Uses OAuth 2.0 and REST API instead of Azure CLI
  - Requires service principal credentials
  - No Azure CLI installation needed

### Improved
- **Performance** - Direct API calls are faster than CLI subprocess calls
- **Reliability** - Structured API responses vs parsing CLI output
- **Deployment** - Fewer system dependencies required
- **Error Handling** - Better error messages from API responses

### Dependencies Removed
- Java JDK (for keystore plugin)
- AWS CLI (for aws-acm plugin) 
- Azure CLI (for azure-keyvault plugin)
- kubectl dependency reduced (k8s-secrets plugin)

## [1.0.1] - 2024-07-31

### Fixed
- Fixed binary executable path in NPM package
- Corrected package.json bin reference to match actual file name

## [1.0.0] - 2024-07-31

### Added
- Initial release of KeyMon SSL certificate collector
- **10 Built-in Plugins**:
  - `domain` - Live HTTPS domain scanning
  - `keystore` - Java keystores (.jks, .p12, .pfx)
  - `cert-folder` - Certificate file directories
  - `pki-bundle` - PKI CA bundles
  - `k8s-secrets` - Kubernetes TLS secrets
  - `nginx` - Nginx configuration files
  - `aws-acm` - AWS Certificate Manager
  - `macos-keychain` - macOS Keychain
  - `postgres-tls` - PostgreSQL TLS certificates
  - `windows-certstore` - Windows Certificate Store
- **Plugin Architecture** - Modular, extensible design
- **Backward Compatibility** - Legacy command-line syntax support
- **Environment Tagging** - Tag certificates with environment and group metadata
- **Certificate Management** - List, filter, and delete certificates
- **Cron Job Scheduling** - Automated certificate collection
- **NPM Package** - Global installation via `npm install -g keymon`