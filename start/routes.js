'use strict'

/*
|--------------------------------------------------------------------------
| Routes
|--------------------------------------------------------------------------
|
| Http routes are entry points to your web application. You can create
| routes for different URL's and bind Controller actions to them.
|
| A complete guide on routing is available here.
| http://adonisjs.com/docs/4.1/routing
|
*/

/** @type {typeof import('@adonisjs/framework/src/Route/Manager')} */
const Route = use('Route')

Route.on('/').render('welcome')

/*
|--------------------------------------------------------------------------
| PDF Generation API Routes
|--------------------------------------------------------------------------
*/
Route.group(() => {
  Route.post('/generate-pdf', 'PdfController.generate')
}).prefix('/api/v1')

// Download PDF yang sudah tersimpan di public/download/
Route.get('/download/:company/:email/:filename', 'PdfController.download')
