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
  Route.post('/register', 'AuthController.register')
  Route.post('/login', 'AuthController.login')
  Route.post('/change-password', 'AuthController.changePassword').middleware(['auth:jwt'])
  Route.post('/generate-pdf', 'PdfController.generate').middleware(['companyAuth'])
  Route.get('/generated-pdfs', 'GeneratedPdfController.index').middleware(['auth:jwt'])
  Route.post('/send-slip-emails', 'BulkEmailController.sendSlips').middleware(['auth:jwt'])
  Route.post('/send-ba-penempatan-emails', 'BulkEmailController.sendBaPenempatan').middleware(['auth:jwt'])
  Route.post('/send-ba-request-id-emails', 'BulkEmailController.sendBaRequestId').middleware(['auth:jwt'])
  Route.post('/send-ba-hold-emails', 'BulkEmailController.sendBaHold').middleware(['auth:jwt'])
  Route.post('/send-ba-rolling-emails', 'BulkEmailController.sendBaRolling').middleware(['auth:jwt'])
  Route.post('/send-ba-hold-activate-emails', 'BulkEmailController.sendBaHoldActivate').middleware(['auth:jwt'])
  Route.post('/send-ba-terminated-emails', 'BulkEmailController.sendBaTerminated').middleware(['auth:jwt'])
  Route.post('/bulk/payslip', 'BulkPdfController.payslipFromExcel').middleware(['auth:jwt'])
  Route.post('/bulk/insentif', 'BulkPdfController.insentifFromExcel').middleware(['auth:jwt'])
  Route.post('/bulk/thr', 'BulkPdfController.thrFromExcel').middleware(['auth:jwt'])
  Route.post('/bulk/ba-penempatan', 'BulkPdfController.baPenempatanFromExcel').middleware(['auth:jwt'])
  Route.post('/bulk/ba-request-id', 'BulkPdfController.baRequestIdFromExcel').middleware(['auth:jwt'])
  Route.post('/bulk/ba-hold', 'BulkPdfController.baHoldFromExcel').middleware(['auth:jwt'])
  Route.post('/bulk/ba-rolling', 'BulkPdfController.baRollingFromExcel').middleware(['auth:jwt'])
  Route.post('/bulk/ba-hold-activate', 'BulkPdfController.baHoldActivateFromExcel').middleware(['auth:jwt'])
  Route.post('/bulk/ba-terminated', 'BulkPdfController.baTerminatedFromExcel').middleware(['auth:jwt'])
}).prefix('/api/v1')

// Download PDF yang sudah tersimpan di public/download/
Route.get('/download/:company/:email/:filename', 'PdfController.download')
