# Azure Production Deployment Guide — SecureVote Zero-Trust Portal

This guide provides step-by-step instructions for deploying SecureVote to **Microsoft Azure** using an enterprise-grade, zero-trust cloud architecture.

---

## 🏛️ Azure Production Architecture

```mermaid
flowchart TD
    subgraph ClientLayer["Edge & Presentation Layer"]
        SWA["Azure Static Web Apps\n(React 18 + Vite + TypeScript)\nGlobal CDN & SSL Termination"]
    end

    subgraph ComputeLayer["Compute & Application Layer"]
        AppService["Azure App Service (Linux, Python 3.11)\nFastAPI Application & Uvicorn\nSystem-Assigned Managed Identity"]
    end

    subgraph SecurityLayer["Zero-Trust Security & Identity"]
        ManagedIdentity["Managed Identity (AAD)"]
        KeyVault["Azure Key Vault\n(kv-securevote-prod)\nRBAC: Key Vault Secrets User"]
    end

    subgraph StorageLayer["Data & Persistence Layer"]
        PostgreSQL[("Azure Database for PostgreSQL\nFlexible Server (v15+)\nFirewall: Allow Azure Services\nSSL: require")]
        BlobStorage[("Azure Blob Storage\nContainer: manifestos (PRIVATE)\nEncrypted at rest (256-bit AES)")]
    end

    SWA -->|HTTPS REST API Requests| AppService
    AppService -->|1. Authenticate with Managed Identity| ManagedIdentity
    ManagedIdentity -->|2. Authorize via RBAC| KeyVault
    KeyVault -->|3. Inject Secrets:\nDATABASE-URL, JWT-SECRET, STORAGE-CONN| AppService
    AppService -->|4. Encrypted DB Queries (SSL/TLS)| PostgreSQL
    AppService -->|5. Store Candidate Manifestos (PDF)| BlobStorage
```

---

## 📋 Prerequisites & CLI Login

Ensure you have the [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) installed and authenticate with your Azure subscription:

```bash
az login
az account set --subscription "<YOUR_SUBSCRIPTION_ID_OR_NAME>"
```

Define environment variables for your deployment shell:

```bash
RESOURCE_GROUP="rg-securevote-prod"
LOCATION="eastus"
PSQL_SERVER="psql-securevote-prod"
PSQL_ADMIN="securevoteadmin"
PSQL_DB="securevote"
KEY_VAULT="kv-securevote-prod"
STORAGE_ACCOUNT="stsecurevoteprod"
APP_SERVICE_PLAN="asp-securevote-prod"
WEBAPP_NAME="app-securevote-backend-prod"
STATIC_WEBAPP_NAME="swa-securevote-frontend"
```

Create the resource group:

```bash
az group create --name $RESOURCE_GROUP --location $LOCATION
```

---

## 🐘 1. Azure Database for PostgreSQL (Flexible Server)

SecureVote requires PostgreSQL in production. SQLite is strictly rejected by the backend when `ENVIRONMENT=production`.

### 1.1 Provision the PostgreSQL Flexible Server
```bash
# Generate a strong password for the database administrator
PSQL_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 20)

az postgres flexible-server create \
  --resource-group $RESOURCE_GROUP \
  --name $PSQL_SERVER \
  --location $LOCATION \
  --admin-user $PSQL_ADMIN \
  --admin-password "$PSQL_PASSWORD" \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --version 15 \
  --storage-size 32 \
  --database-name $PSQL_DB \
  --public-access "0.0.0.0"
```

### 1.2 Firewall & SSL Enforcement
1. **Firewall Rule**: Allow connections from internal Azure App Service compute instances:
   ```bash
   az postgres flexible-server firewall-rule create \
     --resource-group $RESOURCE_GROUP \
     --name $PSQL_SERVER \
     --rule-name "AllowAllAzureServicesAndResourcesWithinAzureIps" \
     --start-ip-address "0.0.0.0" \
     --end-ip-address "0.0.0.0"
   ```
2. **SSL/TLS Setting**: Ensure TLS encryption is enforced:
   ```bash
   az postgres flexible-server parameter set \
     --resource-group $RESOURCE_GROUP \
     --server-name $PSQL_SERVER \
     --name "require_secure_transport" \
     --value "on"
   ```

### 1.3 Formulate Connection String
The SQLAlchemy 2.0 database URL must specify `sslmode=require`:
```
postgresql+psycopg2://<admin-user>:<admin-password>@<server-name>.postgres.database.azure.com:5432/securevote?sslmode=require
```

---

## 🗄️ 2. Azure Blob Storage (Private Manifesto Container)

Candidate manifestos (PDFs) are stored in Azure Blob Storage. In production, local storage is blocked.

### 2.1 Provision Storage Account
```bash
az storage account create \
  --resource-group $RESOURCE_GROUP \
  --name $STORAGE_ACCOUNT \
  --location $LOCATION \
  --sku Standard_LRS \
  --encryption-services blob \
  --allow-blob-public-access false \
  --min-tls-version TLS1_2
```

### 2.2 Create Private Container
Zero-Trust requirement: The container must have **private** access (no anonymous read):
```bash
az storage container create \
  --account-name $STORAGE_ACCOUNT \
  --name "manifestos" \
  --public-access off
```

### 2.3 Retrieve Connection String
```bash
STORAGE_CONNECTION_STRING=$(az storage account show-connection-string \
  --resource-group $RESOURCE_GROUP \
  --name $STORAGE_ACCOUNT \
  --query connectionString -o tsv)
```

---

## 🔐 3. Azure Key Vault & Managed Identity

Sensitive connection strings and signing keys are isolated in Azure Key Vault. When `KEY_VAULT_URL` is set, SecureVote authenticates using **DefaultAzureCredential** (Azure Managed Identity) and retrieves secrets automatically.

### 3.1 Create Azure Key Vault
```bash
az keyvault create \
  --resource-group $RESOURCE_GROUP \
  --name $KEY_VAULT \
  --location $LOCATION \
  --enable-rbac-authorization true
```

### 3.2 Store Production Secrets
```bash
# 1. Database Connection String (PostgreSQL)
az keyvault secret set \
  --vault-name $KEY_VAULT \
  --name "DATABASE-URL" \
  --value "postgresql+psycopg2://${PSQL_ADMIN}:${PSQL_PASSWORD}@${PSQL_SERVER}.postgres.database.azure.com:5432/${PSQL_DB}?sslmode=require"

# 2. JWT Cryptographic Signing Secret (Minimum 32 characters)
PROD_JWT_SECRET=$(openssl rand -hex 32)
az keyvault secret set \
  --vault-name $KEY_VAULT \
  --name "JWT-SECRET" \
  --value "$PROD_JWT_SECRET"

# 3. Azure Blob Storage Connection String
az keyvault secret set \
  --vault-name $KEY_VAULT \
  --name "AZURE-STORAGE-CONNECTION-STRING" \
  --value "$STORAGE_CONNECTION_STRING"
```

---

## 🚀 4. Azure App Service (Backend FastAPI API)

### 4.1 Create Linux App Service Plan
```bash
az appservice plan create \
  --resource-group $RESOURCE_GROUP \
  --name $APP_SERVICE_PLAN \
  --location $LOCATION \
  --is-linux \
  --sku B1
```

### 4.2 Create Web App
```bash
az webapp create \
  --resource-group $RESOURCE_GROUP \
  --plan $APP_SERVICE_PLAN \
  --name $WEBAPP_NAME \
  --runtime "PYTHON:3.11"
```

### 4.3 Configure Startup Command
Set the server to run with Uvicorn, binding to the container's designated `$PORT`:
```bash
az webapp config set \
  --resource-group $RESOURCE_GROUP \
  --name $WEBAPP_NAME \
  --startup-file "sh -c 'uvicorn app.main:app --host 0.0.0.0 --port \${PORT:-8000}'"
```

### 4.4 Enable Managed Identity & Assign Key Vault Role
```bash
# 1. Enable System-Assigned Managed Identity on App Service
PRINCIPAL_ID=$(az webapp identity assign \
  --resource-group $RESOURCE_GROUP \
  --name $WEBAPP_NAME \
  --query principalId -o tsv)

# 2. Grant 'Key Vault Secrets User' role to App Service identity
KEY_VAULT_RESOURCE_ID=$(az keyvault show \
  --name $KEY_VAULT \
  --resource-group $RESOURCE_GROUP \
  --query id -o tsv)

az role assignment create \
  --role "Key Vault Secrets User" \
  --assignee $PRINCIPAL_ID \
  --scope $KEY_VAULT_RESOURCE_ID
```

### 4.5 Set Application Settings (Environment Variables)
```bash
az webapp config appsettings set \
  --resource-group $RESOURCE_GROUP \
  --name $WEBAPP_NAME \
  --settings \
    ENVIRONMENT="production" \
    PORT="8000" \
    KEY_VAULT_URL="https://${KEY_VAULT}.vault.azure.net/" \
    FRONTEND_ORIGIN="https://${STATIC_WEBAPP_NAME}.azurestaticapps.net" \
    AZURE_CONTAINER_NAME="manifestos" \
    ACCESS_TOKEN_EXPIRE_MINUTES="60" \
    LOGIN_RATE_LIMIT_ATTEMPTS="5" \
    LOGIN_RATE_LIMIT_WINDOW_MINUTES="10"
```
*(Notice that `DATABASE_URL`, `JWT_SECRET`, and `AZURE_STORAGE_CONNECTION_STRING` are **not** specified in App Settings — the backend retrieves them securely from Key Vault via Managed Identity).*

---

## 🌐 5. Azure Static Web Apps (Frontend React + Vite)

### 5.1 Create Static Web App
```bash
az staticwebapp create \
  --resource-group $RESOURCE_GROUP \
  --name $STATIC_WEBAPP_NAME \
  --location "eastus2" \
  --sku Standard
```

### 5.2 Configure Build Time API Base URL
In the Azure Portal (or GitHub Actions), configure the build environment variable:
```
VITE_API_BASE_URL=https://app-securevote-backend-prod.azurewebsites.net
```

### 5.3 Single Page Application Routing
The included `frontend/staticwebapp.config.json` automatically handles client-side React Router rewrites:
```json
{
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/assets/*", "/*.{png,jpg,jpeg,gif,svg,ico,json,css,js}"]
  }
}
```

---

## 📊 Environment Variables Reference Matrix

### Backend (Azure App Service)
| Variable | Production Value / Placeholder | Description |
| :--- | :--- | :--- |
| `ENVIRONMENT` | `production` | Enables strict production validation (requires Postgres & Blob Storage). |
| `PORT` | `8000` | Port on which the FastAPI Uvicorn server listens (injected by Azure). |
| `KEY_VAULT_URL` | `https://<vault-name>.vault.azure.net/` | URL of Azure Key Vault for loading secrets via Managed Identity. |
| `FRONTEND_ORIGIN` | `https://<frontend-app>.azurestaticapps.net` | Allowed CORS origin (rejects wildcard `*`). |
| `AZURE_CONTAINER_NAME`| `manifestos` | Target Blob Storage container name for manifesto PDFs. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | JWT token lifespan. |
| `LOGIN_RATE_LIMIT_ATTEMPTS` | `5` | Maximum failed logins before throttling. |
| `LOGIN_RATE_LIMIT_WINDOW_MINUTES` | `10` | Rate limiting rolling window. |

### Azure Key Vault Secrets
| Secret Name in Key Vault | Target App Setting | Description |
| :--- | :--- | :--- |
| `DATABASE-URL` | `DATABASE_URL` | PostgreSQL connection string (`postgresql+psycopg2://...`). |
| `JWT-SECRET` | `JWT_SECRET` | 32+ character cryptographic secret for signing voter tokens. |
| `AZURE-STORAGE-CONNECTION-STRING` | `AZURE_STORAGE_CONNECTION_STRING` | Primary connection string for Azure Blob Storage. |

### Frontend (Azure Static Web Apps)
| Variable | Production Value / Placeholder | Description |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | `https://<backend-app>.azurewebsites.net` | Base URL used by Axios at build time. |

---

## 🤖 6. GitHub Actions Continuous Deployment

The repository includes an automated workflow at `.github/workflows/deploy-backend.yml`.

### Required GitHub Repository Secrets
Navigate to **Settings &rarr; Secrets and variables &rarr; Actions** in your GitHub repository and configure:
1. `AZURE_WEBAPP_NAME`: Name of your Azure App Service (e.g. `app-securevote-backend-prod`).
2. `AZURE_WEBAPP_PUBLISH_PROFILE`: XML publish profile downloaded from the Azure Portal (`App Service &rarr; Overview &rarr; Get publish profile`).

On every push to `main`, the workflow:
1. Runs the full backend test suite (`pytest -v`).
2. Prepares production site-packages.
3. Deploys the package to Azure App Service using official Azure actions.
