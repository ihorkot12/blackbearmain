import fetch from 'node-fetch';

async function checkUrl(url) {
  try {
    const res = await fetch(url);
    console.log(url, res.status);
  } catch (e) {
    console.log(url, 'error');
  }
}

checkUrl('https://ais-dev-52dzs75wldpn6rggyas75b-286910022589.europe-west2.run.app/api/image/step-48');
checkUrl('https://ais-dev-52dzs75wldpn6rggyas75b-286910022589.europe-west2.run.app/api/image/step-47');
