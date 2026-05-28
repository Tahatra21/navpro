#!/usr/bin/env node
/**
 * Smoke test NAVPRO API — jalankan saat backend sudah listen di PORT (default 4000)
 * Usage:
 *   export SMOKE_EMAIL=... SMOKE_PASSWORD=...
 *   node scripts/smoke-test.mjs
 */
const BASE = process.env.API_URL || 'http://localhost:4000';
const EMAIL = process.env.SMOKE_EMAIL;
const PASSWORD = process.env.SMOKE_PASSWORD;
const SA_EMAIL = process.env.SMOKE_SA_EMAIL;
const ASMAN_EMAIL = process.env.SMOKE_ASMAN_EMAIL;

async function req(method, path, { token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function loginAs(email, password) {
  const login = await req('POST', '/api/v1/auth/login', {
    body: { email, password },
  });
  if (!login.ok) {
    throw new Error(`login ${email} failed: ${login.status} ${JSON.stringify(login.data)}`);
  }
  return login.data.token;
}

async function main() {
  console.log('NAVPRO smoke test →', BASE);

  const health = await req('GET', '/health');
  if (!health.ok) {
    console.error('FAIL health', health.status, health.data);
    process.exit(1);
  }
  console.log('OK  GET /health');

  if (!EMAIL || !PASSWORD) {
    console.log('SKIP authenticated tests — set SMOKE_EMAIL and SMOKE_PASSWORD in the environment.');
    console.log('See docs/SECURITY.md');
    return;
  }

  let token;
  try {
    token = await loginAs(EMAIL, PASSWORD);
    console.log('OK  POST /api/v1/auth/login');
  } catch (e) {
    console.error('FAIL login:', e.message);
    process.exit(1);
  }

  const me = await req('GET', '/api/v1/auth/me', { token });
  if (!me.ok) {
    console.error('FAIL me', me.status);
    process.exit(1);
  }
  console.log('OK  GET /api/v1/auth/me →', me.data.user?.role);

  const projects = await req('GET', '/api/v1/projects', { token });
  if (!projects.ok) {
    console.error('FAIL projects', projects.status);
    process.exit(1);
  }
  console.log('OK  GET /api/v1/projects →', projects.data.projects?.length ?? 0, 'items');

  const portfolio = await req('GET', '/api/v1/dashboard/portfolio', { token });
  if (!portfolio.ok) {
    console.error('FAIL portfolio', portfolio.status);
    process.exit(1);
  }
  console.log('OK  GET /api/v1/dashboard/portfolio');

  const role = me.data.user?.role;
  if (role === 'SUPER_ADMIN' || role === 'FINANCE_ADMIN') {
    const adminOrg = await req('GET', '/api/v1/admin/org-units', { token });
    if (!adminOrg.ok) {
      console.error('FAIL admin org-units', adminOrg.status, adminOrg.data);
      process.exit(1);
    }
    const orgCount = adminOrg.data.org_units?.length ?? 0;
    console.log('OK  GET /api/v1/admin/org-units →', orgCount, 'units');
    if (orgCount < 13) {
      console.warn('WARN expected ≥13 org units (4 Pusat + 9 SBU), got', orgCount);
    }

    const sla = await req('GET', '/api/v1/admin/sla-config', { token });
    if (!sla.ok) {
      console.error('FAIL sla-config', sla.status);
      process.exit(1);
    }
    const slaKeys = (sla.data.sla || []).map((r) => r.role_key);
    console.log('OK  GET /api/v1/admin/sla-config →', slaKeys.join(', '));
    if (!slaKeys.includes('ASMAN') || !slaKeys.includes('MANAGER')) {
      console.warn('WARN missing ASMAN/MANAGER in sla_config — run: node src/seed.js');
    }
  } else {
    console.log('SKIP admin endpoints (role', role, ')');
  }

  if (SA_EMAIL && PASSWORD) {
    try {
      const saToken = role === 'SA' ? token : await loginAs(SA_EMAIL, PASSWORD);
      const cfgOrg = await req('GET', '/api/v1/config/org-units', { token: saToken });
      if (!cfgOrg.ok) {
        console.error('FAIL config/org-units', cfgOrg.status, cfgOrg.data);
        process.exit(1);
      }
      console.log('OK  GET /api/v1/config/org-units (SA) →', cfgOrg.data.org_units?.length ?? 0, 'units');

      const saMe = await req('GET', '/api/v1/auth/me', { token: saToken });
      const ouId = saMe.data.user?.org_unit_id || cfgOrg.data.org_units?.[0]?.id;
      if (ouId) {
        const create = await req('POST', '/api/v1/projects', {
          token: saToken,
          body: {
            project_name: `Smoke ${Date.now()}`,
            contract_start_date: new Date().toISOString().slice(0, 10),
            project_duration_months: 12,
            org_unit_id: ouId,
            capex: [],
            opex: [],
            revenue: [],
          },
        });
        if (!create.ok) {
          console.error('FAIL create project with org_unit', create.status, create.data);
          process.exit(1);
        }
        const pid = create.data.project?.id;
        const seg = create.data.project?.segment;
        console.log('OK  POST /api/v1/projects (SA+org) →', pid?.slice(0, 8), 'segment:', seg);
      } else {
        console.warn('WARN SA has no org_unit — skip create project test');
      }
    } catch (e) {
      console.warn('WARN SA sub-tests:', e.message);
    }
  } else {
    console.log('SKIP SA sub-tests — set SMOKE_SA_EMAIL (same SMOKE_PASSWORD if shared)');
  }

  if (ASMAN_EMAIL && PASSWORD) {
    try {
      const asmanToken = await loginAs(ASMAN_EMAIL, PASSWORD);
      const queue = await req('GET', '/api/v1/approvals/queue', { token: asmanToken });
      if (!queue.ok) {
        console.error('FAIL approvals/queue', queue.status, queue.data);
        process.exit(1);
      }
      console.log('OK  GET /api/v1/approvals/queue (ASMAN) →', queue.data.items?.length ?? 0, 'items');
      const summary = await req('GET', '/api/v1/approvals/queue/summary', { token: asmanToken });
      if (!summary.ok) {
        console.error('FAIL approvals/queue/summary', summary.status);
        process.exit(1);
      }
      console.log('OK  GET /api/v1/approvals/queue/summary → pending', summary.data.summary?.pending_count);

      const first = queue.data.items?.[0];
      if (first?.project_id) {
        const myStep = await req('GET', `/api/v1/approvals/projects/${first.project_id}/my-step`, {
          token: asmanToken,
        });
        if (!myStep.ok) {
          console.error('FAIL approvals/my-step', myStep.status, myStep.data);
          process.exit(1);
        }
        console.log('OK  GET /api/v1/approvals/projects/:id/my-step →', myStep.data.step?.id?.slice(0, 8) || 'none');
        if (myStep.data.step?.id) {
          const cand = await req('GET', `/api/v1/approvals/steps/${myStep.data.step.id}/delegate-candidates`, {
            token: asmanToken,
          });
          if (!cand.ok) {
            console.error('FAIL delegate-candidates', cand.status, cand.data);
            process.exit(1);
          }
          console.log('OK  GET delegate-candidates →', cand.data.candidates?.length ?? 0);
        }
      }
    } catch (e) {
      console.warn('WARN ASMAN sub-tests:', e.message);
    }
  } else {
    console.log('SKIP ASMAN sub-tests — set SMOKE_ASMAN_EMAIL');
  }

  if (role === 'SUPER_ADMIN' || role === 'FINANCE_ADMIN') {
    const preview = await req(
      'GET',
      '/api/v1/admin/sla-config/preview-due?role_key=ASMAN',
      { token }
    );
    if (!preview.ok) {
      console.error('FAIL sla preview-due', preview.status, preview.data);
      process.exit(1);
    }
    console.log('OK  GET /api/v1/admin/sla-config/preview-due →', preview.data.due_at?.slice(0, 10));

    const testCode = `SMOKE-${Date.now().toString(36).slice(-4)}`;
    const createOu = await req('POST', '/api/v1/admin/org-units', {
      token,
      body: {
        code: testCode,
        name: 'Smoke Test Unit',
        type: 'SBU',
        segment: 'ENT2',
      },
    });
    if (!createOu.ok) {
      console.error('FAIL create org-unit', createOu.status, createOu.data);
      process.exit(1);
    }
    const ouId = createOu.data.id;
    console.log('OK  POST /api/v1/admin/org-units →', testCode);

    const updateOu = await req('PUT', `/api/v1/admin/org-units/${ouId}`, {
      token,
      body: { name: 'Smoke Test Unit Updated' },
    });
    if (!updateOu.ok) {
      console.error('FAIL update org-unit', updateOu.status);
      process.exit(1);
    }
    console.log('OK  PUT /api/v1/admin/org-units/:id');

    const delOu = await req('DELETE', `/api/v1/admin/org-units/${ouId}`, { token });
    if (!delOu.ok) {
      console.error('FAIL delete org-unit', delOu.status, delOu.data);
      process.exit(1);
    }
    console.log('OK  DELETE /api/v1/admin/org-units/:id');
  }

  console.log('\nSmoke test passed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
