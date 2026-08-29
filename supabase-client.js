(function(){
  var SUPABASE_URL = 'https://sotissdamewkrbacdfxv.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_TdUNEIP02PQRaDPXlwtXng_I6q-q0jj';
  window.sbClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  window.requireAuth = async function(){
    var result = await window.sbClient.auth.getSession();
    var session = result.data.session;
    if (!session){
      window.location.href = 'compte.html?next=' + encodeURIComponent(location.pathname.split('/').pop());
      return null;
    }
    return session.user;
  };

  window.signOutAndRedirect = async function(){
    await window.sbClient.auth.signOut();
    window.location.href = 'index.html';
  };
})();
