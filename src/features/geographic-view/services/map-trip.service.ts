export class MapService {
  static createPositionStream(tripId: string, assetId: string) {
    let eventSource: EventSource;

    return new ReadableStream({
      async start(controller) {
        eventSource = new EventSource(
          `/app/api/map/trip?tripId=${tripId}&assetId=${assetId}`,
        );

        eventSource.onopen = () => {
          //console.log("SSE connection established");
        };

        eventSource.onmessage = (event) => {
          try {
            const position = JSON.parse(event.data);
            controller.enqueue(position);
          } catch (err) {
            // TODO: Check if this is the correct way to handle the error Ignore some common errors
            //console.error("Failed to parse position data:", err, event.data);
          }
        };

        eventSource.onerror = (error) => {
          // TODO: Check if this is the correct way to handle the error Ignore some common errors
          //console.error("EventSource error:", error);
          if (eventSource.readyState === 2) {
            controller.error(error);
            eventSource.close();
          }
        };
      },
      cancel() {
        if (eventSource) {
          //console.log("Closing EventSource connection");
          eventSource.close();
        }
      },
    });
  }
}
