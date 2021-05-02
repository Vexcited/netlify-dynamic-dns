const 
	NetlifyAPI = require('netlify'),
	publicIp = require('public-ip'),
	yargs = require('yargs'),
	fs = require('fs');
    fetch = require('node-fetch');

// Get args from CLI.
const argv = yargs
	.option('token', {
		description: 'Token from "User settings" > "Applications" > "New access token"',
		alias: 't',
		type: 'string'
	})
	.option('hostname', {
		description: 'DNS name to update',
		alias: 'h',
		type: 'string'
	})
	.option('type', {
		description: '"A" (IPv4) || "AAAA" (IPv6) || "CNAME" (ngrok)',
		alias: 'a',
		type: 'string'
	})
	.option('ngrok', {
      description: 'ngrok adress',
		alias: 'n',
        default: 'http://localhost:4040',
		type: 'string'
	})
	.argv;

// Write logs.txt
const writeLog = (success, message) => {
	let content = `${(success) ? "[OK]" : "[ERROR]"} ${message}`;
	fs.appendFile(`${__dirname}/console.log`, `${content}\n`, function (err) {
		if (err) throw err;
		console.log(content);
	});
}

// Initalize client from `token` argument.
const client = (argv.token) ? new NetlifyAPI(argv.token) : "";

/**
 * Fetch every zones from `argv.token`
 */
const getZones = async () => {
	try {
		return await client.getDnsZones({})
	} 
	catch (e) {
		writeLog(false, e);
	}
}

/**
 * Fetch every records from `zoneId`
 * @param {String} zoneId - Zone ID
 */
const getRecords = async (zoneId) => {
	try {
		return await client.getDnsRecords({
			zoneId
		});
	}
	catch (e) {
		writeLog(false, e);
	}
}

/**
 * Update record from its ID and its ZoneID.
 * Delete then create new one.
 * @param {String} zoneId - Zone ID
 * @param {String} dnsRecordId - Record ID from Zone ID
 * @param {String} ip - New IP
 */
const createRecord = async (zoneId,hostname, ip) => {
	writeLog(true, "Found a matching record ! Updating it...")
	try {
        // Create new DNS Record with type from args.
        await client.createDnsRecord({
            zoneId,
            body: {
                type: argv.type,
                hostname: hostname,
                value: ip
            }
        })
        .then (() =>{
            writeLog(true, `IP Updated successfully ! Exiting...`)}
        )
        .catch (e =>
            writeLog(false, `Failed to create new record\n${e}`)
        );
    }
	catch (e) {
		writeLog(false, e);
	}
};

const updateRecord = async (zoneId,hostname, dnsRecordId, ip) => {
	writeLog(true, "Found a matching record ! Updating it...")

	try {
		// Delete DNS record
		await client.deleteDnsRecord({
			zoneId, dnsRecordId
		})
		.then (async () => {
			writeLog(true, `Current record successfully deleted ! Creating a new record...`);

			// Create new DNS Record with type from args.
			await client.createDnsRecord({
				zoneId,
				body: {
					type: argv.type,
					hostname: hostname,
					value: ip
				}
			})
			.then (() => 
				writeLog(true, `IP Updated successfully ! Exiting...`)
			)
			.catch (e =>
				writeLog(false, `Failed to create new record\n${e}`)
			);
		})
		.catch (e => 
			writeLog(false, `Failed to delete current record\n${e}`)
		);
	}
	catch (e) {
		writeLog(false, e);
	}
};

/**
 * Update IP with your IP `ip`
 * @param {String} newIp - IP (v4 || v6)
 */
const updateIP = async (newIp,hostname) => {

	// Fetching zones, from `token`
	getZones().then(zones => {
		writeLog(true, `${zones.length} zones fetched !`);

		// For each zones fetched: fetch their records...
		zones.forEach (zone => {

			// Fetching records from `zone.id`.
			getRecords(zone.id).then(records => {
				writeLog(true, `Records (from zone ${zone.id}) fetched !`)
				writeLog(true, `If the script exits here, then no records matches with hostname argument.`);

				// For each records fetched: check if `record.hostname`
				// is matching with `hostname`.
                if(!records.find( rec => rec['hostname'] === hostname )){
                  if(hostname.includes(zone.name)){
				      createRecord(zone.id,hostname, newIp);
                  }
                }
                else{
				records.forEach (record => {
					if (record.hostname == hostname) {
						// Update IP if record value is not the same.
						if (record.value != newIp) {
							updateRecord(zone.id,hostname, record.id, newIp);
						}
						else {
							writeLog(true, `Same IP ([Record] ${record.value} - [Current IP] ${newIp}) ! Exiting...`);
						}
					}
				})
                }
			})
			.catch (e => {
				writeLog(false, e);
			});
		});
	})
	.catch (e => {
		writeLog(false, e);
	});
}

// Start script...
// Check if type is A (IPv4) or AAAA (IPv6)
const start = async () => {
	if (argv.type === "A")
		await publicIp.v4()
		.then (ip => updateIP(ip,argv.hostname))
	else if (argv.type === "AAAA")
		await publicIp.v6()
		.then (ip => updateIP(ip,argv.hostname));
	else if (argv.type === "CNAME")
        fetch(argv.ngrok+'/api/tunnels', {
          "method": "GET",
        })
        .then(res => res.json())
        .then(async (json) => {
          for await (const n of json.tunnels){
          let cname = new URL(n.public_url)
          updateIP(cname.hostname,n.name+"."+argv.hostname)
          }
        });
}

// Check if arguments is missing...
if (!argv.token || !argv.hostname || !argv.type) {
	writeLog(false, 'Args: --hostname || --type || --token is missing ! Exiting...');
}
else {
	// Refresh log file...
	fs.writeFile(`${__dirname}/console.log`, "", function (err) {
		if (err) throw err;
		writeLog(true, `[${new Date()}] Started update process.\nHostname (to update): ${argv.hostname}\nType: ${argv.type}\nToken: ${argv.token.substr(0, 8)}...`);
		
		// Start !
		start();
	});
}
