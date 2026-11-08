// Plain-text fingerprint of the dashboard data baked into this build.
import { dataVersion } from '../data/menu';

export const GET = () => new Response(dataVersion, { headers: { 'Content-Type': 'text/plain' } });
