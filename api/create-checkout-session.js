var SUPABASE_URL = 'https://sotissdamewkrbacdfxv.supabase.co';
var SUPABASE_ANON_KEY = 'sb_publishable_TdUNEIP02PQRaDPXlwtXng_I6q-q0jj';

async function getUserFromToken(accessToken){
  if (!accessToken) return null;
  var res = await fetch(SUPABASE_URL + '/auth/v1/user', {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + accessToken
    }
  });
  if (!res.ok) return null;
  return res.json();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  var user = await getUserFromToken(req.body && req.body.access_token);
  if (!user || !user.id) {
    res.status(401).json({ error: 'Tu dois être connectée pour t\'abonner.' });
    return;
  }

  var plan = (req.body && req.body.plan) === 'annuel' ? 'annuel' : 'mensuel';
  var secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    res.status(500).json({ error: 'Stripe non configuré côté serveur' });
    return;
  }

  var origin = req.headers.origin || ('https://' + req.headers.host);

  var plans = {
    mensuel: { name: 'MYSLF — Abonnement mensuel', amount: 999, interval: 'month' },
    annuel: { name: 'MYSLF — Abonnement annuel', amount: 5999, interval: 'year' }
  };
  var p = plans[plan];

  var params = new URLSearchParams();
  params.append('mode', 'subscription');
  params.append('client_reference_id', user.id);
  params.append('customer_email', user.email);
  params.append('metadata[plan]', plan);
  params.append('metadata[user_id]', user.id);
  params.append('subscription_data[metadata][plan]', plan);
  params.append('subscription_data[metadata][user_id]', user.id);
  params.append('line_items[0][price_data][currency]', 'eur');
  params.append('line_items[0][price_data][product_data][name]', p.name);
  params.append('line_items[0][price_data][recurring][interval]', p.interval);
  params.append('line_items[0][price_data][unit_amount]', String(p.amount));
  params.append('line_items[0][quantity]', '1');
  params.append('success_url', origin + '/bienvenue.html?plan=' + plan + '&session_id={CHECKOUT_SESSION_ID}');
  params.append('cancel_url', origin + '/index.html#tarifs');

  try {
    var response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + secretKey,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    var data = await response.json();
    if (!response.ok) {
      console.error('Stripe error:', data);
      res.status(502).json({ error: (data.error && data.error.message) || 'Erreur Stripe' });
      return;
    }

    res.status(200).json({ url: data.url });
  } catch (err) {
    console.error('Checkout session error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
}
