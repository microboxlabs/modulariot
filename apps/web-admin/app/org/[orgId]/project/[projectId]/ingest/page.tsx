import { ConnectStreamButton } from "../../../../components/ConnectStreamButton";

export default function IngestPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Data Ingest</h1>
          <p className="text-gray-600 mt-1">
            Connect your devices and applications to stream data into this project
          </p>
        </div>
        <ConnectStreamButton />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Getting Started</h2>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                  1
                </div>
                <div>
                  <h3 className="font-medium">Choose your protocol</h3>
                  <p className="text-gray-600 text-sm">
                    Click "Connect Stream" to see available protocols and connection details
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                  2
                </div>
                <div>
                  <h3 className="font-medium">Configure your device</h3>
                  <p className="text-gray-600 text-sm">
                    Use the provided connection strings and sample code to configure your devices
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                  3
                </div>
                <div>
                  <h3 className="font-medium">Start streaming</h3>
                  <p className="text-gray-600 text-sm">
                    Your data will appear in the devices and logs sections once streaming begins
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Protocol Overview</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    📡
                  </div>
                  <div>
                    <div className="font-medium">HTTPS REST</div>
                    <div className="text-sm text-gray-600">Simple POST requests</div>
                  </div>
                </div>
                <div className="text-sm text-gray-500">Recommended for getting started</div>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    ⚡
                  </div>
                  <div>
                    <div className="font-medium">WebSocket</div>
                    <div className="text-sm text-gray-600">Real-time bidirectional</div>
                  </div>
                </div>
                <div className="text-sm text-gray-500">Low latency applications</div>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                    📱
                  </div>
                  <div>
                    <div className="font-medium">MQTT</div>
                    <div className="text-sm text-gray-600">IoT standard with QoS</div>
                  </div>
                </div>
                <div className="text-sm text-gray-500">Embedded devices</div>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                    🚀
                  </div>
                  <div>
                    <div className="font-medium">AMQP</div>
                    <div className="text-sm text-gray-600">High-throughput messaging</div>
                  </div>
                </div>
                <div className="text-sm text-gray-500">Large fleets</div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white border rounded-lg p-6">
            <h3 className="font-medium mb-3">Quick Stats</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Active connections</span>
                <span className="font-medium">0</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Messages today</span>
                <span className="font-medium">0</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Last message</span>
                <span className="font-medium text-gray-400">Never</span>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-medium text-blue-900 mb-2">Need Help?</h3>
            <p className="text-sm text-blue-800 mb-3">
              Check out our documentation for detailed integration guides and examples.
            </p>
            <a 
              href="#" 
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              View Documentation →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}