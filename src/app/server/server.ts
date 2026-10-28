import { createApp, lakebase, server, serving } from '@databricks/appkit';
import { ensureTicketsTable, registerTicketRoutes } from './routes/tickets';
import { registerFleetRoutes } from './routes/fleet';
import { registerAssistantRoutes } from './routes/assistant';

createApp({
  plugins: [
    lakebase(), // Postgres pool: reads serving.machine_health, writes app.service_tickets
    server(),
    serving({
      endpoints: {
        agent: { env: 'DATABRICKS_SERVING_ENDPOINT_NAME' }, // the fleet-agent endpoint
      },
    }),
  ],
  async onPluginsReady(appkit) {
    await ensureTicketsTable(appkit.lakebase).catch((err: unknown) => {
      console.error('[tickets] could not create app.service_tickets:', err);
    });
    appkit.server.extend((app) => {
      registerFleetRoutes(app, appkit.lakebase);
      registerTicketRoutes(app, appkit.lakebase);
      registerAssistantRoutes(app, appkit.serving('agent'));
    });
  },
}).catch(console.error);
