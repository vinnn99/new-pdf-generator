'use strict'

const path = require('path')
const cooperationAgreementTemplate = require('./cooperation_agreement')

const EXEL_COMPANY_NAME = 'PT. EXEL INTEGRASI SOLUSINDO'
const EXEL_LOGO_PATH = path.join(__dirname, '..', '..', 'resources', 'images', 'logo-old.png')

module.exports = function exelCooperationAgreementTemplate(payloadData = {}) {
  return cooperationAgreementTemplate({
    ...payloadData,
    template: 'exel_cooperation_agreement',
    companyName: payloadData.companyName || EXEL_COMPANY_NAME,
    logoPath: payloadData.logoPath || payloadData.companyLogoPath || EXEL_LOGO_PATH,
    companyLogoPath: payloadData.companyLogoPath || payloadData.logoPath || EXEL_LOGO_PATH
  })
}
