export interface Protocol {
  id: string;
  name: string;
  description: string;
  icon: string;
  badges: string[];
}

export interface Step {
  title: string;
  code: string;
  description: string;
}

export interface ConnectionDetails {
  title: string;
  description: string;
  uri: string;
  parameters: { name: string; value: string; description?: string }[];
  sampleCode?: { [key: string]: string };
  steps?: Step[];
}

export const PROTOCOLS: Protocol[] = [
  {
    id: "rest",
    name: "REST API",
    description: "Simple HTTP POST requests",
    icon: "Server",
    badges: ["Works everywhere", "Fire-and-forget"]
  },
  {
    id: "websocket",
    name: "WebSocket",
    description: "Low latency bidirectional connection",
    icon: "Wifi",
    badges: ["Low latency", "Real-time", "Requires TLS"]
  },
  {
    id: "mqtt",
    name: "MQTT",
    description: "IoT messaging protocol",
    icon: "MessageCircle",
    badges: ["IoT standard", "QoS support", "Retain messages"]
  },
  {
    id: "amqp",
    name: "AMQP",
    description: "High-throughput message queuing",
    icon: "Waves",
    badges: ["High throughput", "Back-pressure", "Shared subscriptions"]
  },
  {
    id: "atcmd",
    name: "AT Command",
    description: "Legacy GPS tracker protocol",
    icon: "Terminal",
    badges: ["Legacy devices", "TCP raw", "Server-side parsing"]
  }
];

export function buildConnectionUri(
  protocol: string, 
  orgId: string, 
  projectId: string, 
  apiKey?: string
): string {

  const ingestUrl = process.env.NEXT_PUBLIC_INGEST_URL;

  const uris = {
    rest: `${ingestUrl}/org/${orgId}/proj/${projectId}`,
    websocket: `wss://ws.modulariot.com/stream?org=${orgId}&proj=${projectId}${apiKey ? `&token=${apiKey}` : ''}`,
    mqtt: `mqtts://mqtt.modulariot.com`,
    amqp: `persistent://modulariot/${orgId}/${projectId}`,
    atcmd: `tcp://at.modulariot.com:7010`
  };
  
  return uris[protocol as keyof typeof uris] || '';
}

interface ConnectionDetailsParams {
  protocol: string;
  orgId: string;
  projectId: string;
  apiKey?: string;
  serverUrl?: string;
}

export interface Auth0Credentials {
  domain: string;
  clientId: string;
  audience: string;
  grantType: string;
}

export interface IngestConfig {
  url: string;
  endpoint: string;
}

export function buildAuth0Curl(auth0: Auth0Credentials): string {
  return `curl -X POST "https://${auth0.domain}/oauth/token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "client_id": "${auth0.clientId}",
    "client_secret": "YOUR_CLIENT_SECRET",
    "audience": "${auth0.audience}",
    "grant_type": "${auth0.grantType}"
  }'`;
}

export function buildRestCurl(ingestUrl: string, endpoint: string): string {
  const fullUrl = `${ingestUrl}${endpoint}`;
  return `curl -X POST "${fullUrl}" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $TOKEN" \\
  -d '{
    "deviceId": "device123",
    "timestamp": "2024-01-01T00:00:00Z",
    "data": {
      "temperature": 25.3
    }
  }'`;
}

export function getConnectionDetails({protocol, orgId, projectId, apiKey}: ConnectionDetailsParams): ConnectionDetails {
  const uri = buildConnectionUri(protocol, orgId, projectId, apiKey);
  
  const details: { [key: string]: ConnectionDetails } = {
    rest: {
      title: "REST API (Two-Step Authentication)",
      description: "Secure two-step process: First obtain an Auth0 access token, then use it to send data.",
      uri,
      parameters: [
        { name: "Step 1", value: "Get Auth0 Token", description: "Obtain short-lived access token (expires in 30 days)" },
        { name: "Step 2", value: "Send Data", description: "Use token to authenticate data ingestion" },
        { name: "Security", value: "Bearer Token", description: "JWT token from Auth0 M2M flow" },
        { name: "Host", value: process.env.NEXT_PUBLIC_INGEST_URL ?? '' }
      ],
      steps: [
        {
          title: "① Get an Auth token (once every 30 days)",
          code: "# This will be populated by the modal with real Auth0 credentials",
          description: "Authenticate with Auth0 to receive a short-lived access token"
        },
        {
          title: "② Send data", 
          code: "# This will be populated by the modal with real ingest URL",
          description: "Use the access token to send data to your project endpoint"
        }
      ],
      sampleCode: {
        curl: `# Step 1: Get Auth0 Token\ncurl -X POST "https://YOUR_DOMAIN.auth0.com/oauth/token" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "client_id": "YOUR_CLIENT_ID",\n    "client_secret": "YOUR_CLIENT_SECRET",\n    "audience": "https://modulariot.com/v1/project/admin",\n    "grant_type": "client_credentials"\n  }'\n\n# Step 2: Send Data\ncurl -X POST "${uri}" \\\n  -H "Content-Type: application/json" \\\n  -H "Authorization: Bearer $TOKEN" \\\n  -d '{\n    "deviceId": "device123",\n    "timestamp": "2024-01-01T00:00:00Z",\n    "data": {"temperature": 25.3}\n  }'`,
        javascript: `// Step 1: Get Auth0 Token\nconst tokenResponse = await fetch('https://YOUR_DOMAIN.auth0.com/oauth/token', {\n  method: 'POST',\n  headers: { 'Content-Type': 'application/json' },\n  body: JSON.stringify({\n    client_id: 'YOUR_CLIENT_ID',\n    client_secret: 'YOUR_CLIENT_SECRET',\n    audience: 'https://modulariot.com/v1/project/admin',\n    grant_type: 'client_credentials'\n  })\n});\nconst { access_token } = await tokenResponse.json();\n\n// Step 2: Send Data\nconst response = await fetch('${uri}', {\n  method: 'POST',\n  headers: {\n    'Content-Type': 'application/json',\n    'Authorization': \`Bearer \${access_token}\`\n  },\n  body: JSON.stringify({\n    deviceId: 'device123',\n    timestamp: new Date().toISOString(),\n    data: { temperature: 25.3 }\n  })\n});`,
        python: `import requests\n\n# Step 1: Get Auth0 Token\ntoken_response = requests.post('https://YOUR_DOMAIN.auth0.com/oauth/token', \n  json={\n    'client_id': 'YOUR_CLIENT_ID',\n    'client_secret': 'YOUR_CLIENT_SECRET',\n    'audience': 'https://modulariot.com/v1/project/admin',\n    'grant_type': 'client_credentials'\n  }\n)\naccess_token = token_response.json()['access_token']\n\n# Step 2: Send Data\nresponse = requests.post('${uri}', \n  headers={\n    'Content-Type': 'application/json',\n    'Authorization': f'Bearer {access_token}'\n  },\n  json={\n    'deviceId': 'device123',\n    'timestamp': '2024-01-01T00:00:00Z',\n    'data': {'temperature': 25.3}\n  }\n)`
      }
    },
    websocket: {
      title: "WebSocket Stream",
      description: "Ideal for real-time applications requiring low latency and bidirectional communication.",
      uri,
      parameters: [
        { name: "Protocol", value: "WSS (TLS)" },
        { name: "Format", value: "ND-JSON (newline-delimited)" },
        { name: "Auth", value: "Query parameter token" },
        { name: "Port", value: "443" }
      ],
      sampleCode: {
        javascript: `const ws = new WebSocket('${uri}');
ws.onopen = () => {
  ws.send(JSON.stringify({
    deviceId: 'device123',
    timestamp: new Date().toISOString(),
    data: { temperature: 25.3 }
  }));
};
ws.onmessage = (event) => {
  console.log('Received:', JSON.parse(event.data));
};`,
        python: `import websocket
import json

def on_open(ws):
    ws.send(json.dumps({
        'deviceId': 'device123',
        'timestamp': '2024-01-01T00:00:00Z',
        'data': {'temperature': 25.3}
    }))

ws = websocket.WebSocketApp('${uri}', on_open=on_open)
ws.run_forever()`
      }
    },
    mqtt: {
      title: "MQTT Broker",
      description: "Standard IoT protocol with QoS, retain, and last will testament features.",
      uri,
      parameters: [
        { name: "Host", value: "mqtt.miot.io" },
        { name: "Port", value: "8883 (TLS)" },
        { name: "Topic", value: `org/${orgId}/proj/${projectId}/device/{deviceId}` },
        { name: "Username", value: projectId },
        { name: "Password", value: apiKey || 'YOUR_API_KEY' }
      ],
      sampleCode: {
        python: `import paho.mqtt.client as mqtt
import json

client = mqtt.Client()
client.username_pw_set('${projectId}', '${apiKey || 'YOUR_API_KEY'}')
client.tls_set()
client.connect('mqtt.miot.io', 8883, 60)

topic = 'org/${orgId}/proj/${projectId}/device/device123'
payload = json.dumps({
    'timestamp': '2024-01-01T00:00:00Z',
    'data': {'temperature': 25.3}
})
client.publish(topic, payload)`,
        javascript: `const mqtt = require('mqtt');

const client = mqtt.connect('${uri}', {
  username: '${projectId}',
  password: '${apiKey || 'YOUR_API_KEY'}'
});

client.on('connect', () => {
  const topic = 'org/${orgId}/proj/${projectId}/device/device123';
  const payload = JSON.stringify({
    timestamp: new Date().toISOString(),
    data: { temperature: 25.3 }
  });
  client.publish(topic, payload);
});`
      }
    },
    amqp: {
      title: "AMQP via Pulsar",
      description: "High-throughput messaging with back-pressure control and shared subscriptions.",
      uri,
      parameters: [
        { name: "Service URL", value: "pulsar+ssl://pulsar.miot.io:6651" },
        { name: "Topic", value: `persistent://miot/${orgId}/${projectId}` },
        { name: "Auth", value: "Token authentication" },
        { name: "Token", value: apiKey || 'YOUR_API_KEY' }
      ],
      sampleCode: {
        python: `import pulsar

client = pulsar.Client('pulsar+ssl://pulsar.miot.io:6651',
                      authentication=pulsar.AuthenticationToken('${apiKey || 'YOUR_API_KEY'}'))

producer = client.create_producer('${uri}')
producer.send(b'{"deviceId": "device123", "timestamp": "2024-01-01T00:00:00Z", "data": {"temperature": 25.3}}')

client.close()`,
        javascript: `// Using pulsar-client npm package
const Pulsar = require('pulsar-client');

const client = new Pulsar.Client({
  serviceUrl: 'pulsar+ssl://pulsar.miot.io:6651',
  authentication: new Pulsar.AuthenticationToken('${apiKey || 'YOUR_API_KEY'}')
});

const producer = await client.createProducer({
  topic: '${uri}'
});

await producer.send({
  data: Buffer.from(JSON.stringify({
    deviceId: 'device123',
    timestamp: new Date().toISOString(),
    data: { temperature: 25.3 }
  }))
});`
      }
    },
    atcmd: {
      title: "AT Command TCP",
      description: "Raw TCP connection for legacy GPS trackers using AT command format.",
      uri,
      parameters: [
        { name: "Host", value: "at.modulariot.com" },
        { name: "Port", value: "7010" },
        { name: "Protocol", value: "TCP (raw)" },
        { name: "Format", value: "Plain text AT commands" }
      ],
      sampleCode: {
        python: `import socket

sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.connect(('at.miot.io', 7010))

# Send GPRMC format
gprmc = "+GPRMC=123456.000,A,1234.5678,N,09876.5432,W,0.0,0.0,010124,,,A*5E"
sock.send(f"{gprmc}\\r\\n".encode())

response = sock.recv(1024)
print(response.decode())
sock.close()`,
        javascript: `const net = require('net');

const client = new net.Socket();
client.connect(7010, 'at.miot.io', () => {
  // Send GPRMC format
  const gprmc = '+GPRMC=123456.000,A,1234.5678,N,09876.5432,W,0.0,0.0,010124,,,A*5E';
  client.write(gprmc + '\\r\\n');
});

client.on('data', (data) => {
  console.log('Received:', data.toString());
  client.destroy();
});`
      }
    }
  };
  
  return details[protocol] ?? details.rest!;
}