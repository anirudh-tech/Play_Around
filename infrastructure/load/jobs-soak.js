import http from 'k6/http';
import { check, sleep } from 'k6';

const API = __ENV.API_URL ?? 'http://localhost:4000';

export const options = {
  scenarios: {
    soak: {
      executor: 'constant-vus',
      vus: 2,
      duration: __ENV.DURATION ?? '5m',
    },
  },
};

export default function soak() {
  const live = http.get(`${API}/health`);
  const ready = http.get(`${API}/api/v1/health/ready`);
  check(live, { live: (r) => r.status === 200 });
  check(ready, { ready: (r) => r.status === 200 });
  sleep(5);
}
