import urllib.request
import json
import urllib.error
import sys

BASE_URL = 'http://localhost:8000/api/v1'

def make_req(path, method='GET', data=None, token=None, org_id='org-acme-corp'):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    if org_id:
        headers['X-Organization-Id'] = org_id
        
    encoded_data = json.dumps(data).encode('utf-8') if data is not None else None
    req = urllib.request.Request(f'{BASE_URL}{path}', data=encoded_data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode('utf-8')), resp.headers
    except urllib.error.HTTPError as e:
        try:
            body = json.loads(e.read().decode('utf-8'))
        except Exception:
            body = e.reason
        return e.code, body, e.headers

def run_tests():
    print("=================================================================")
    print("SECUREFLOW AUTHENTICATION, GOOGLE SSO & RBAC VERIFICATION")
    print("=================================================================")

    results = []

    # 1. Valid Login Owner
    code, body, _ = make_req('/auth/login', 'POST', {'email': 'sarah.chen@acmecloud.io', 'password': 'SecureFlow2026!'})
    results.append(('Valid Login (Owner: Sarah Chen)', code == 200 and 'access_token' in body, code, 'Token issued successfully'))
    owner_token = body.get('access_token')

    # 2. Valid Login Developer
    code, body, _ = make_req('/auth/login', 'POST', {'email': 'elena.rostova@acmecloud.io', 'password': 'SecureFlow2026!'})
    results.append(('Valid Login (Developer: Elena Rostova)', code == 200 and 'access_token' in body, code, 'Token issued successfully'))
    dev_token = body.get('access_token')

    # 3. Valid Login Viewer
    code, body, _ = make_req('/auth/login', 'POST', {'email': 'maya.patel@acmecloud.io', 'password': 'SecureFlow2026!'})
    results.append(('Valid Login (Viewer: Maya Patel)', code == 200 and 'access_token' in body, code, 'Token issued successfully'))
    viewer_token = body.get('access_token')

    # 4. Wrong password
    code, body, _ = make_req('/auth/login', 'POST', {'email': 'sarah.chen@acmecloud.io', 'password': 'WrongPassword123!'})
    results.append(('Wrong Password Rejection (401)', code == 401 and body.get('detail') == 'Incorrect email or password', code, str(body)))

    # 5. Unknown email
    code, body, _ = make_req('/auth/login', 'POST', {'email': 'nonexistent@acmecloud.io', 'password': 'SecureFlow2026!'})
    results.append(('Unknown Email Rejection (401)', code == 401 and body.get('detail') == 'Incorrect email or password', code, str(body)))

    # 6. Missing fields (422)
    code, body, _ = make_req('/auth/login', 'POST', {'email': 'sarah.chen@acmecloud.io'})
    results.append(('Missing Password Validation (422)', code == 422, code, 'Schema validation caught missing field'))

    # 7. Google OAuth URL Generation
    code, body, _ = make_req('/auth/google/url', 'GET')
    results.append(('Google OAuth URL Generation (200)', code == 200 and 'accounts.google.com' in body.get('url', ''), code, f"URL: {body.get('url', '')[:45]}..."))

    # 8. Google OIDC Callback Exchange
    code, body, _ = make_req('/auth/google/callback', 'POST', {'code': 'auth_code_sample_dev_test', 'state': 'secureflow-oauth-state'})
    results.append(('Google OIDC Callback & Session (200)', code == 200 and 'access_token' in body, code, f"Token type: {body.get('token_type')}"))

    # 9. Protected /auth/me with valid token
    code, body, _ = make_req('/auth/me', 'GET', token=owner_token)
    results.append(('Protected /auth/me Valid Token (200)', code == 200 and body.get('active_role') == 'Owner', code, f"Role: {body.get('active_role')}, Perms: {len(body.get('permissions', []))}"))

    # 10. Protected /auth/me without token (401)
    code, body, _ = make_req('/auth/me', 'GET')
    results.append(('Protected /auth/me No Token (401)', code == 401, code, str(body)))

    # 11. Protected /auth/me with invalid token (401)
    code, body, _ = make_req('/auth/me', 'GET', token='invalid.token.string')
    results.append(('Protected /auth/me Invalid Token (401)', code == 401, code, str(body)))

    # 12. RBAC: Viewer attempting to create project (must be 403 Forbidden)
    code, body, _ = make_req('/projects', 'POST', {'name': 'Unauthorized Project', 'key': 'UNAUTH'}, token=viewer_token)
    results.append(('RBAC: Viewer Project Create (403)', code == 403, code, str(body)))

    # 13. RBAC: Viewer attempting to create workflow (must be 403 Forbidden)
    code, body, _ = make_req('/workflows', 'POST', {'project_id': 'proj-pay-01', 'name': 'Unauthorized WF', 'risk_level': 'low', 'steps': [{'name': 'Step 1'}]}, token=viewer_token)
    results.append(('RBAC: Viewer Workflow Create (403)', code == 403, code, str(body)))

    # 14. Rate Limit Headers Verification
    code, body, hdrs = make_req('/projects', 'GET', token=owner_token)
    remaining = hdrs.get('X-RateLimit-Remaining')
    results.append(('Rate Limiter Headers Active', remaining is not None, code, f'Remaining: {remaining}'))

    all_passed = True
    for name, passed, status_code, details in results:
        if not passed:
            all_passed = False
        status_icon = 'PASS' if passed else 'FAIL'
        print(f"[{status_icon}] {name:42} | HTTP: {status_code} | {details}")

    print("=================================================================")
    if all_passed:
        print(f"ALL {len(results)}/{len(results)} AUTHENTICATION, GOOGLE SSO & RBAC CHECKS PASSED!")
    else:
        print("SOME TESTS FAILED!")
    print("=================================================================")

if __name__ == '__main__':
    run_tests()
