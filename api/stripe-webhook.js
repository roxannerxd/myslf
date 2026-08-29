import crypto from 'crypto';

export const config = {
  api: { bodyParser: false }
};

var SUPABASE_URL = 'https://sotissdamewkrbacdfxv.supabase.co';

function readRawBody(req){
  return new Promise(function(resolve, reject){
    var chunks = [];
    req.on('data', function(chunk){ chunks.push(chunk); });
    req.on('end', function(){ resolve(Buffer.concat(chunks)); });
    req.on('error', reject);
  });
}

function verifyStripeSignature(rawBody, sigHeader, secret){
  if (!sigHeader) throw new Error('Missing Stripe-Signature header');
  var parts = {};
  sigHeader.split(',').forEach(function(part){
    var idx = part.indexOf('=');
    parts[part.slice(0, idx)] = part.slice(idx + 1);
  });
  var timestamp = parts.t;
  var signature = parts.v1;
  if (!timestamp || !signature) throw new Error('Invalid Stripe-Signature header');

  var signedPayload = timestamp + '.' + rawBody.toString('utf8');
  var expectedSig = crypto.createHmac('sha256', secret).update(signedPayload, 'utf8').digest('hex');

  var sigBuffer = Buffer.from(signature, 'hex');
  var expectedBuffer = Buffer.from(expectedSig, 'hex');
  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)){
    throw new Error('Signature mismatch');
  }

  var now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > 300){
    throw new Error('Timestamp too old');
  }

  return JSON.parse(rawBody.toString('utf8'));
}

async function supabaseAdmin(path, options){
  var serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  var res = await fetch(SUPABASE_URL + '/rest/v1/' + path, Object.assign({
    headers: Object.assign({
      'apikey': serviceKey,
      'Authorization': 'Bearer ' + serviceKey,
      'Content-Type': 'application/json'
    }, (options && options.headers) || {})
  }, options || {}));
  return res;
}

async function upsertByUserId(row){
  var res = await supabaseAdmin('subscriptions', {
    method: 'POST',
    headers: { 'Prefer': 'resolution=merge-duplicates' },
    body: JSON.stringify(row)
  });
  if (!res.ok){
    console.error('upsert subscription failed', await res.text());
  }
}

async function updateByCustomerId(customerId, patch){
  var res = await supabaseAdmin('subscriptions?stripe_customer_id=eq.' + encodeURIComponent(customerId), {
    method: 'PATCH',
    body: JSON.stringify(patch)
  });
  if (!res.ok){
    console.error('update subscription failed', await res.text());
  }
}

export default async function handler(req, res){
  if (req.method !== 'POST'){
    res.status(405).end();
    return;
  }

  var webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret){
    res.status(500).json({ error: 'Webhook non configuré côté serveur' });
    return;
  }

  var rawBody;
  var event;
  try {
    rawBody = await readRawBody(req);
    event = verifyStripeSignature(rawBody, req.headers['stripe-signature'], webhookSecret);
  } catch (err){
    console.error('Webhook signature verification failed:', err.message);
    res.status(400).send('Webhook Error: ' + err.message);
    return;
  }

  try {
    if (event.type === 'checkout.session.completed'){
      var session = event.data.object;
      var userId = session.client_reference_id;
      if (userId){
        await upsertByUserId({
          user_id: userId,
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription,
          status: 'active',
          plan: (session.metadata && session.metadata.plan) || null,
          updated_at: new Date().toISOString()
        });
      }
    } else if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted'){
      var sub = event.data.object;
      await updateByCustomerId(sub.customer, {
        status: event.type === 'customer.subscription.deleted' ? 'canceled' : sub.status,
        current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
        updated_at: new Date().toISOString()
      });
    }
  } catch (err){
    console.error('Webhook handling failed:', err);
    res.status(500).json({ error: 'Erreur de traitement du webhook' });
    return;
  }

  res.status(200).json({ received: true });
}
