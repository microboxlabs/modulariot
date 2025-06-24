/**
 * Auto-generated: DO NOT EDIT BY HAND
 * @module ingest
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { routeSchema } from './ingest.schemas.js';
import * as zlib from 'zlib';
import { promisify } from 'util';

const gunzip = promisify(zlib.gunzip);

export default async function ingestRoutes(fastify: FastifyInstance) {
  // POST /ingest - Device data ingestion endpoint
  fastify.post('/ingest', {
    schema: routeSchema.postIngest,
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // TODO: Validate API token and check for 'ingest' scope
        const authHeader = request.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return reply.code(401).send({
            error: 'MISSING_TOKEN',
            message: 'Bearer token required'
          });
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' - safe because we checked above
        
        // TODO: Implement proper token validation and scope checking
        // For now, return mock validation
        if (!token || token === 'invalid') {
          return reply.code(401).send({
            error: 'INVALID_TOKEN',
            message: 'Invalid or expired token'
          });
        }

        // Mock scope validation - should check if token has 'ingest' scope
        if (token === 'no-ingest-scope') {
          return reply.code(403).send({
            error: 'INSUFFICIENT_SCOPE',
            message: 'Token requires ingest scope'
          });
        }

        let rawBody = request.body;

        // Ensure we have a string body
        if (typeof rawBody !== 'string' && !Buffer.isBuffer(rawBody)) {
          return reply.code(400).send({
            error: 'INVALID_BODY',
            message: 'Request body must be string or buffer'
          });
        }

        let bodyString: string;

        // Handle gzip compression if present
        if (request.headers['content-encoding'] === 'gzip') {
          try {
            const buffer = Buffer.isBuffer(rawBody) ? rawBody as Buffer : Buffer.from(rawBody as string);
            const decompressed = await gunzip(buffer);
            bodyString = decompressed.toString('utf8');
          } catch (error) {
            return reply.code(400).send({
              error: 'INVALID_COMPRESSION',
              message: 'Failed to decompress gzipped content'
            });
          }
        } else {
          bodyString = typeof rawBody === 'string' ? rawBody : (rawBody as Buffer).toString('utf8');
        }
        
        // Process NDJSON - split by newlines and parse each line
        const lines = bodyString.split('\n').filter((line: string) => line.trim() !== '');
        const errors: Array<{ line: number; error: string; data: string }> = [];
        let processed = 0;

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          try {
            const data = JSON.parse(line!);
            
            // Basic validation - ensure required fields exist
            if (!data.deviceId || !data.ts || !data.type) {
              errors.push({
                line: i + 1,
                error: 'Missing required fields: deviceId, ts, type',
                data: line!
              });
              continue;
            }

            // TODO: Validate deviceId format (ULID)
            // TODO: Validate timestamp is reasonable
            // TODO: Process and store the device data
            // TODO: Trigger symptom analysis pipeline
            
            // Mock processing - in reality this would:
            // 1. Validate device exists and belongs to org from token
            // 2. Store data in time-series database
            // 3. Trigger real-time symptom detection
            // 4. Update device last-seen timestamp
            console.log(`Processing data for device ${data.deviceId}, type: ${data.type}`);
            
            processed++;
          } catch (parseError) {
            errors.push({
              line: i + 1,
              error: 'Invalid JSON format',
              data: line!
            });
          }
        }

        return reply.code(200).send({
          success: true,
          processed,
          errors: errors.length > 0 ? errors : []
        });

      } catch (error) {
        fastify.log.error('Ingest endpoint error:', error);
        return reply.code(500).send({
          error: 'INTERNAL_ERROR',
          message: 'Failed to process ingest request'
        });
      }
    }
  });

  // Add content type parser for NDJSON
  fastify.addContentTypeParser(
    ['application/x-ndjson', 'text/plain'],
    { parseAs: 'string' },
    function (request, body, done) {
      done(null, body);
    }
  );

  // Add content type parser for gzipped content
//   fastify.addContentTypeParser(
//     'application/x-ndjson',
//     { parseAs: 'buffer' },
//     function (request, body, done) {
//       done(null, body);
//     }
//   );
} 