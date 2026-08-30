export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { message, history, story } = req.body || {};

  if (!message || typeof message !== 'string' || !message.trim()) {
    res.status(400).json({ error: 'Message manquant' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Clé API non configurée côté serveur' });
    return;
  }

  let systemPrompt = [
    "Tu es la compagne de MYSLF, une application qui accompagne des femmes en reconstruction après une relation amoureuse difficile (rupture, relation toxique, dépendance affective).",
    "",
    "Ton rôle : écouter avec empathie, valider ce que la personne ressent, puis proposer une perspective ou un conseil concret — pas seulement enchaîner les questions. Réponds en 2 à 4 phrases maximum, dans un ton chaleureux, direct, jamais culpabilisant. Tutoie toujours.",
    "",
    "Règles importantes :",
    "- Ne dis jamais \"il faut que tu l'oublies\" et ne juge jamais son ex. Aide-la à comprendre ce qu'elle ressent et ce dont elle a besoin, plutôt que de lui dicter quoi faire.",
    "- Si elle exprime l'envie de contacter son ex, ne le lui interdis pas — aide-la à distinguer le fait, l'interprétation, l'émotion et le besoin derrière cette envie.",
    "- Tu ne remplaces jamais un thérapeute ou un médecin. Si elle exprime une détresse sérieuse (idées suicidaires, danger immédiat, mise en danger), invite-la clairement et calmement à contacter une aide professionnelle : le 3114 (numéro national de prévention du suicide, gratuit, 24/7) ou le 15/112 en urgence.",
    "- Tu n'es pas là pour qu'elle dépende de toi indéfiniment : encourage-la, quand c'est pertinent, à aussi s'appuyer sur ses proches et sa vie réelle.",
    "- Ne romantise jamais la relation passée et ne critique jamais durement la personne non plus."
  ].join('\n');

  if (story && typeof story === 'object') {
    var lines = [];
    function joinField(v){ return Array.isArray(v) ? v.join(', ') : v; }
    if (story.duration) lines.push('Durée de la relation : ' + story.duration);
    if (story.repeated) lines.push('Ruptures répétées : oui');
    if (story.timeSince) lines.push('Depuis quand c\'est terminé : ' + story.timeSince);
    if (story.breakupReason && story.breakupReason.length) lines.push('Pourquoi ça s\'est terminé : ' + joinField(story.breakupReason));
    if (story.trigger && story.trigger.length) lines.push('Déclencheurs principaux : ' + joinField(story.trigger));
    if (story.difficulty && story.difficulty.length) lines.push('Sa plus grande difficulté : ' + joinField(story.difficulty));
    if (story.neverAgain && story.neverAgain.length) lines.push('Ce qu\'elle ne veut plus revivre : ' + joinField(story.neverAgain));
    if (story.goal && story.goal.length) lines.push('Son objectif : ' + joinField(story.goal));
    if (story.notes) lines.push('Ce qu\'elle a ajouté avec ses mots : ' + story.notes);

    if (lines.length){
      systemPrompt += '\n\nVoici ce que cette personne a déjà partagé sur son histoire — utilise-le naturellement pour personnaliser tes réponses, sans jamais le réciter comme une liste :\n' + lines.join('\n');
    }
  }

  var messages = [];
  if (Array.isArray(history)) {
    history.slice(-12).forEach(function(m){
      if (m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim()) {
        messages.push({ role: m.role, content: m.content });
      }
    });
  }
  messages.push({ role: 'user', content: message });

  try {
    var response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 400,
        system: systemPrompt,
        messages: messages
      })
    });

    if (!response.ok) {
      var errText = await response.text();
      console.error('Anthropic API error:', response.status, errText);
      res.status(502).json({ error: 'Erreur de connexion' });
      return;
    }

    var data = await response.json();
    var reply = (data.content && data.content[0] && data.content[0].text) || "Je suis là, mais je n'ai pas réussi à répondre cette fois. Réessaie ?";
    res.status(200).json({ reply: reply });
  } catch (err) {
    console.error('Chat handler error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
}
