export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
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
