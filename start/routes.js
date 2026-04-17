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

  // Admin - user management
  Route.get('/admin/users', 'AdminUserController.index').middleware(['auth:jwt'])
  Route.post('/admin/users', 'AdminUserController.store').middleware(['auth:jwt'])
  Route.put('/admin/users/:id', 'AdminUserController.update').middleware(['auth:jwt'])
  Route.post('/admin/users/:id/deactivate', 'AdminUserController.deactivate').middleware(['auth:jwt'])
  Route.post('/admin/users/:id/password', 'AdminUserController.resetPassword').middleware(['auth:jwt'])

  // Admin - company management
  Route.get('/admin/companies', 'AdminCompanyController.index').middleware(['auth:jwt'])
  Route.post('/admin/companies', 'AdminCompanyController.store').middleware(['auth:jwt'])
  Route.put('/admin/companies/:id', 'AdminCompanyController.update').middleware(['auth:jwt'])
  Route.post('/admin/companies/:id/activate', 'AdminCompanyController.activate').middleware(['auth:jwt'])
  Route.post('/admin/companies/:id/deactivate', 'AdminCompanyController.deactivate').middleware(['auth:jwt'])
  Route.get('/admin/templates', 'AdminCompanyController.templates').middleware(['auth:jwt'])
  Route.post('/admin/companies/:id/templates', 'AdminCompanyController.setTemplates').middleware(['auth:jwt'])
  Route.get('/admin/dynamic-templates', 'AdminTemplateController.index').middleware(['auth:jwt'])
  Route.post('/admin/dynamic-templates', 'AdminTemplateController.store').middleware(['auth:jwt'])
  Route.put('/admin/dynamic-templates/:id', 'AdminTemplateController.update').middleware(['auth:jwt'])
  Route.post('/admin/dynamic-templates/:id/activate', 'AdminTemplateController.activate').middleware(['auth:jwt'])
  Route.post('/admin/dynamic-templates/:id/deactivate', 'AdminTemplateController.deactivate').middleware(['auth:jwt'])
  Route.post('/generate-pdf', 'PdfController.generate').middleware(['companyAuth'])
  Route.get('/generated-pdfs', 'GeneratedPdfController.index').middleware(['auth:jwt'])
  Route.get('/batches', 'BatchController.index').middleware(['auth:jwt'])
  Route.get('/batches/:batch_id', 'BatchController.show').middleware(['auth:jwt'])
  Route.post('/send-slip-emails', 'BulkEmailController.sendSlips').middleware(['auth:jwt'])
  Route.post('/send-ba-penempatan-emails', 'BulkEmailController.sendBaPenempatan').middleware(['auth:jwt'])
  Route.post('/send-ba-request-id-emails', 'BulkEmailController.sendBaRequestId').middleware(['auth:jwt'])
  Route.post('/send-ba-hold-emails', 'BulkEmailController.sendBaHold').middleware(['auth:jwt'])
  Route.post('/send-ba-rolling-emails', 'BulkEmailController.sendBaRolling').middleware(['auth:jwt'])
  Route.post('/send-ba-hold-activate-emails', 'BulkEmailController.sendBaHoldActivate').middleware(['auth:jwt'])
  Route.post('/send-ba-takeout-emails', 'BulkEmailController.sendBaTakeout').middleware(['auth:jwt'])
  Route.post('/send-ba-terminated-emails', 'BulkEmailController.sendBaTerminated').middleware(['auth:jwt'])
  // Single email (generate + kirim) per template
  Route.post('/send/ba-penempatan', 'SingleEmailController.sendBaPenempatan').middleware(['auth:jwt'])
  Route.post('/send/ba-request-id', 'SingleEmailController.sendBaRequestId').middleware(['auth:jwt'])
  Route.post('/send/ba-hold', 'SingleEmailController.sendBaHold').middleware(['auth:jwt'])
  Route.post('/send/ba-rolling', 'SingleEmailController.sendBaRolling').middleware(['auth:jwt'])
  Route.post('/send/ba-hold-activate', 'SingleEmailController.sendBaHoldActivate').middleware(['auth:jwt'])
  Route.post('/send/ba-takeout', 'SingleEmailController.sendBaTakeout').middleware(['auth:jwt'])
  Route.post('/send/ba-terminated', 'SingleEmailController.sendBaTerminated').middleware(['auth:jwt'])
  Route.post('/preview/:template', 'BaPreviewController.generate').middleware(['auth:jwt'])
  Route.get('/preview/file/:id', 'BaPreviewController.download').middleware(['auth:jwt'])
  // Backward compatibility untuk endpoint preview BA lama.
  Route.post('/preview/ba/:template', 'BaPreviewController.generate').middleware(['auth:jwt'])
  Route.get('/preview/ba/file/:id', 'BaPreviewController.download').middleware(['auth:jwt'])
  Route.get('/company/api-key', 'CompanyController.apiKey').middleware(['auth:jwt'])
  Route.post('/contacts', 'ContactController.store').middleware(['auth:jwt'])
  Route.get('/contacts', 'ContactController.index').middleware(['auth:jwt'])
  Route.get('/contacts/:id', 'ContactController.show').middleware(['auth:jwt'])
  Route.put('/contacts/:id', 'ContactController.update').middleware(['auth:jwt'])
  Route.delete('/contacts/:id', 'ContactController.destroy').middleware(['auth:jwt'])
  Route.post('/bulk/payslip', 'BulkPdfController.payslipFromExcel').middleware(['auth:jwt'])
  Route.post('/bulk/insentif', 'BulkPdfController.insentifFromExcel').middleware(['auth:jwt'])
  Route.post('/bulk/thr', 'BulkPdfController.thrFromExcel').middleware(['auth:jwt'])
  Route.post('/bulk/ba-penempatan', 'BulkPdfController.baPenempatanFromExcel').middleware(['auth:jwt'])
  Route.post('/bulk/ba-request-id', 'BulkPdfController.baRequestIdFromExcel').middleware(['auth:jwt'])
  Route.post('/bulk/ba-hold', 'BulkPdfController.baHoldFromExcel').middleware(['auth:jwt'])
  Route.post('/bulk/ba-rolling', 'BulkPdfController.baRollingFromExcel').middleware(['auth:jwt'])
  Route.post('/bulk/ba-hold-activate', 'BulkPdfController.baHoldActivateFromExcel').middleware(['auth:jwt'])
  Route.post('/bulk/ba-takeout', 'BulkPdfController.baTakeoutFromExcel').middleware(['auth:jwt'])
  Route.post('/bulk/ba-terminated', 'BulkPdfController.baTerminatedFromExcel').middleware(['auth:jwt'])
  Route.get('/signature-urls', 'SignatureUrlController.index').middleware(['auth:jwt'])
  Route.get('/signature-urls/:id', 'SignatureUrlController.show').middleware(['auth:jwt'])
  Route.post('/signature-urls', 'SignatureUrlController.store').middleware(['auth:jwt'])
  Route.put('/signature-urls/:id', 'SignatureUrlController.update').middleware(['auth:jwt'])
  Route.delete('/signature-urls/:id', 'SignatureUrlController.destroy').middleware(['auth:jwt'])
  Route.get('/email-logs', 'EmailLogController.index').middleware(['auth:jwt'])
  // Dashboard summary
  Route.get('/dashboard/summary', 'DashboardController.summary').middleware(['auth:jwt'])
}).prefix('/api/v1')

// Download PDF yang sudah tersimpan di public/download/
Route.get('/download/:company/:email/:filename', 'PdfController.download')
