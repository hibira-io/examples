// Served at /service-worker.js: shows the notification even when no tab is open.
importScripts('https://cdn.jsdelivr.net/npm/@hibira-io/push-web@1/dist/service-worker.js');
self.HibiraPush.endpoint = 'https://ws.hibira.io';
