# ModularIoT ECM Server

Alfresco Content Services extensions for ModularIoT. Provides content models, behaviors, and UI customizations for the resource directory module.

## Module Structure

```
ecm-srv/
├── pom.xml                             # Parent POM (packaging=pom)
├── miot-resource-directory-repo/       # ACS platform tier (content models, behaviors, webscripts)
└── miot-resource-directory-share/      # Share tier (UI forms, dashlets, customizations)
```

## Content Model

The base content model (`miot:resourceDirectory`) defines entity types, document types, and shared aspects for the resource directory. Client-specific aspects are created at runtime via the Alfresco CMM API — not in this module.

### Entity Types (extend `cm:folder`)

Each entity is a folder node in Alfresco. Documents are stored as typed child nodes.

| Type | Description | Key Properties |
|------|-------------|----------------|
| `miot:resourceEntity` | Base type for all entities | entityId, externalId, clientId, entityStatus, sourceSystem, licensePlate, maxWeight |
| `miot:vehicle` | Fleet vehicles (trucks) | vin, vehicleType, volume |
| `miot:trailer` | Trailers | trailerType |
| `miot:driver` | Drivers/operators | firstName, lastName, rut, licenseNumber, licenseCategory, licenseExpires |
| `miot:carrier` | Transport carrier companies | carrierName, transportLicense, transportLicenseExpires |

### Document Types (extend `cm:content`)

| Type | Description | Key Properties |
|------|-------------|----------------|
| `miot:driverLicense` | Driver license document | docLicenseCategory, issuingAuthority, expiryDate, licenseStatus |
| `miot:medicalExam` | Medical examination | examType, examDate, validUntil, examResult |
| `miot:certification` | Professional certification (ADR, forklift, etc.) | certType, certExpiry, issuedBy |
| `miot:insurancePolicy` | Insurance policy | policyNumber, insurer, coverage, policyExpiry |
| `miot:inspectionReport` | Technical inspection | inspectionType, inspectionDate, inspectionResult, nextDue |
| `miot:performanceEval` | Performance evaluation | evalPeriod, overallRating, evaluator |

### Shared Aspects

| Aspect | Description | Properties |
|--------|-------------|------------|
| `miot:scorable` | KPI scoring | compositeScore (0-100), lastScoreUpdate |
| `miot:insurable` | Insurance tracking | cargoInsuranceExpires, liabilityInsuranceExpires |
| `miot:inspectable` | Inspection tracking | technicalInspectionExpires, tachographRevision |

### Client-Specific Aspects (runtime, not in AMP)

Client extensions are created dynamically via the Alfresco Custom Model Manager (CMM) REST API during client onboarding. This avoids redeployment for each new client.

```bash
# Example: create a client-specific model via CMM API
POST /alfresco/api/-default-/public/alfresco/versions/1/cmm
{
  "name": "acme",
  "description": "ACME Corp custom properties"
}
```

## Quick Start

### Build

```bash
# Build the repo module (produces AMP/JAR)
cd miot-resource-directory-repo
mvn clean package -DskipTests

# Build the share module
cd miot-resource-directory-share
mvn clean package -DskipTests
```

### Run with Docker

Each module includes a Docker Compose setup for local development:

```bash
# Start ACS with the repo extension
cd miot-resource-directory-repo
./run.sh build_start

# Start Share with the share extension
cd miot-resource-directory-share
./run.sh build_start
```

### Verify Content Model

After deployment, verify the content model via the classes webscript:

```bash
# Check base entity type
curl -u admin:admin http://localhost:8080/alfresco/s/api/classes/miot_resourceEntity

# Check subtypes
curl -u admin:admin http://localhost:8080/alfresco/s/api/classes/miot_vehicle
curl -u admin:admin http://localhost:8080/alfresco/s/api/classes/miot_driver

# Check aspects
curl -u admin:admin http://localhost:8080/alfresco/s/api/classes/miot_scorable
```

## Tech Stack

- **Alfresco SDK 4.x**
- **Alfresco Community Edition 23.x**
- **Java 17**
- **Maven** — AMP packaging

## Adding New Modules

Generate a new child module from inside `ecm-srv/`:

```bash
# Platform (repo) module
mvn archetype:generate -Dfilter=org.alfresco:alfresco-platform-archetype

# Share module
mvn archetype:generate -Dfilter=org.alfresco:alfresco-share-archetype
```

Then add the generated module to the parent POM's `<modules>` list.
