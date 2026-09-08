/**
 * H4CK3R M4P - Cyber Threat Intelligence
 * Attack-Map Simulation Model (geography + attack-type profiles)
 *
 * NOTE: This is the CONFIG for the clearly-labeled SIMULATED attack map, not a
 * "demo feed". No open, keyless, real-time global attack telemetry API exists
 * for a static site, so the map animates a realistic simulation from these nodes.
 * 
 * @author 0xsh4n
 * @url https://github.com/0xsh4n
 */

export const THREAT_NODES = [
    { country: 'United States', code: 'US', city: 'Washington D.C.', lat: 38.9072, lng: -77.0369, weight: 9 },
    { country: 'United States', code: 'US', city: 'San Jose', lat: 37.3382, lng: -121.8863, weight: 8 },
    { country: 'United States', code: 'US', city: 'New York', lat: 40.7128, lng: -74.0060, weight: 8 },
    { country: 'China', code: 'CN', city: 'Beijing', lat: 39.9042, lng: 116.4074, weight: 9 },
    { country: 'China', code: 'CN', city: 'Shanghai', lat: 31.2304, lng: 121.4737, weight: 8 },
    { country: 'Russia', code: 'RU', city: 'Moscow', lat: 55.7558, lng: 37.6173, weight: 9 },
    { country: 'Russia', code: 'RU', city: 'Saint Petersburg', lat: 59.9343, lng: 30.3351, weight: 7 },
    { country: 'Germany', code: 'DE', city: 'Frankfurt', lat: 50.1109, lng: 8.6821, weight: 7 },
    { country: 'Germany', code: 'DE', city: 'Berlin', lat: 52.5200, lng: 13.4050, weight: 6 },
    { country: 'United Kingdom', code: 'GB', city: 'London', lat: 51.5074, lng: -0.1278, weight: 8 },
    { country: 'France', code: 'FR', city: 'Paris', lat: 48.8566, lng: 2.3522, weight: 7 },
    { country: 'Ukraine', code: 'UA', city: 'Kyiv', lat: 50.4501, lng: 30.5234, weight: 7 },
    { country: 'Iran', code: 'IR', city: 'Tehran', lat: 35.6892, lng: 51.3890, weight: 7 },
    { country: 'North Korea', code: 'KP', city: 'Pyongyang', lat: 39.0392, lng: 125.7625, weight: 6 },
    { country: 'South Korea', code: 'KR', city: 'Seoul', lat: 37.5665, lng: 126.9780, weight: 7 },
    { country: 'Japan', code: 'JP', city: 'Tokyo', lat: 35.6762, lng: 139.6503, weight: 8 },
    { country: 'India', code: 'IN', city: 'Bengaluru', lat: 12.9716, lng: 77.5946, weight: 8 },
    { country: 'India', code: 'IN', city: 'New Delhi', lat: 28.6139, lng: 77.2090, weight: 7 },
    { country: 'Brazil', code: 'BR', city: 'São Paulo', lat: -23.5505, lng: -46.6333, weight: 7 },
    { country: 'Israel', code: 'IL', city: 'Tel Aviv', lat: 32.0853, lng: 34.7818, weight: 7 },
    { country: 'Netherlands', code: 'NL', city: 'Amsterdam', lat: 52.3676, lng: 4.9041, weight: 7 },
    { country: 'Singapore', code: 'SG', city: 'Singapore', lat: 1.3521, lng: 103.8198, weight: 8 },
    { country: 'Australia', code: 'AU', city: 'Sydney', lat: -33.8688, lng: 151.2093, weight: 6 },
    { country: 'Canada', code: 'CA', city: 'Toronto', lat: 43.6532, lng: -79.3832, weight: 6 },
    { country: 'Taiwan', code: 'TW', city: 'Taipei', lat: 25.0330, lng: 121.5654, weight: 7 },
    { country: 'Vietnam', code: 'VN', city: 'Hanoi', lat: 21.0285, lng: 105.8542, weight: 5 },
    { country: 'Turkey', code: 'TR', city: 'Istanbul', lat: 41.0082, lng: 28.9784, weight: 6 },
    { country: 'United Arab Emirates', code: 'AE', city: 'Dubai', lat: 25.2048, lng: 55.2708, weight: 6 },
    { country: 'Sweden', code: 'SE', city: 'Stockholm', lat: 59.3293, lng: 18.0686, weight: 5 },
    { country: 'Switzerland', code: 'CH', city: 'Zurich', lat: 47.3769, lng: 8.5417, weight: 6 }
];

export const ATTACK_PROFILES = [
    {
        type: 'Brute Force',
        severities: ['HIGH', 'MEDIUM'],
        services: ['SSH (22)', 'RDP (3389)', 'FTP (21)', 'Telnet (23)'],
        signatures: ['Hydra Auth Flood', 'Medusa Dictionary Spray', 'Fail2ban Trigger Alert']
    },
    {
        type: 'DDoS',
        severities: ['CRITICAL', 'HIGH'],
        services: ['DNS Amplification (53)', 'NTP Monlist (123)', 'HTTPS Flood (443)', 'SYN Flood (80)'],
        signatures: ['Mirai Volumetric Storm', 'TCP RST Flood Wave', 'CLDAP Reflective Amp']
    },
    {
        type: 'Exploit Attempt',
        severities: ['CRITICAL', 'HIGH'],
        services: ['HTTPS (443)', 'Apache Struts (8080)', 'WebLogic (7001)', 'Spring Boot (8080)'],
        signatures: ['CVE-2024-RCE Probe', 'Log4Shell JNDI Injection', 'Path Traversal Scan']
    },
    {
        type: 'Ransomware',
        severities: ['CRITICAL'],
        services: ['SMB (445)', 'Active Directory (389)', 'Remote Management (5985)'],
        signatures: ['Shadow Copy Invalidation', 'EternalBlue Exploit Spray', 'PsExec Lateral Movement']
    },
    {
        type: 'Malware',
        severities: ['HIGH', 'MEDIUM'],
        services: ['C2 Beaconing (8443)', 'IRC (6667)', 'Tor Gateway (9050)'],
        signatures: ['Cobalt Strike Malleable C2', 'AsyncRAT Payload Injection', 'QakBot Persistence Routine']
    },
    {
        type: 'Suspicious Scanning',
        severities: ['LOW', 'MEDIUM'],
        services: ['ZMap Fast Scan', 'Masscan Port Sweep', 'Nmap SYN Stealth'],
        signatures: ['Global Subnet Probe', 'Vulnerable Gateway Hunt', 'Shodan Automated Telemetry']
    },
    {
        type: 'Botnet',
        severities: ['HIGH', 'MEDIUM'],
        services: ['IoT CoAP (5683)', 'UPnP (1900)', 'MikroTik Winbox (8291)'],
        signatures: ['Necurs Node Heartbeat', 'Dark Nexus Propagation', 'Gafgyt Infection Cycle']
    },
    {
        type: 'Phishing',
        severities: ['MEDIUM', 'LOW'],
        services: ['SMTP (25)', 'SMTPS (465)', 'IMAP (993)'],
        signatures: ['Spear-Phishing Cred Harvest', 'Evilginx2 Reverse Proxy', 'Typosquatting MX Probe']
    }
];

export const INITIAL_ATTACKS = [
    {
        id: 'atk-init-01',
        timestamp: Date.now() - 6000,
        sourceCountry: 'Russia',
        sourceCity: 'Moscow',
        sourceLat: 55.7558,
        sourceLng: 37.6173,
        targetCountry: 'United States',
        targetCity: 'Washington D.C.',
        targetLat: 38.9072,
        targetLng: -77.0369,
        attackType: 'Exploit Attempt',
        severity: 'CRITICAL',
        sourceIPMasked: '185.220.***.***',
        targetIPMasked: '198.51.***.***',
        targetService: 'HTTPS (443)',
        signature: 'Zero-Day Auth Bypass'
    },
    {
        id: 'atk-init-02',
        timestamp: Date.now() - 4200,
        sourceCountry: 'China',
        sourceCity: 'Shanghai',
        sourceLat: 31.2304,
        sourceLng: 121.4737,
        targetCountry: 'Germany',
        targetCity: 'Frankfurt',
        targetLat: 50.1109,
        targetLng: 8.6821,
        attackType: 'Brute Force',
        severity: 'HIGH',
        sourceIPMasked: '222.186.***.***',
        targetIPMasked: '194.12.***.***',
        targetService: 'SSH (22)',
        signature: 'Dictionary Spray Attack'
    },
    {
        id: 'atk-init-03',
        timestamp: Date.now() - 2500,
        sourceCountry: 'North Korea',
        sourceCity: 'Pyongyang',
        sourceLat: 39.0392,
        sourceLng: 125.7625,
        targetCountry: 'South Korea',
        targetCity: 'Seoul',
        targetLat: 37.5665,
        targetLng: 126.9780,
        attackType: 'DDoS',
        severity: 'CRITICAL',
        sourceIPMasked: '175.45.***.***',
        targetIPMasked: '210.94.***.***',
        targetService: 'DNS Amplification (53)',
        signature: 'Volumetric Threat Spike'
    }
];
