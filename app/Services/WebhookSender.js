'use strict'

/**
 * Webhook Sender Utility
 * 
 * Send webhooks using Node.js built-in http/https modules
 * Properly handles URL parsing, headers, and error logging
 */

const http = require('http')
const https = require('https')
const { URL } = require('url')

class WebhookSender {
  /**
   * Send a webhook POST request
   * 
   * @param {String} callbackUrl - Full webhook URL (e.g., https://webhook.site/unique-id)
   * @param {Object} payload - JSON payload to send
   * @param {Object} options - Configuration options
   * @param {Object} options.headers - Custom headers to include (default: {})
   * @param {Number} options.timeout - Request timeout in ms (default: 10000)
   * @param {Number} options.maxRetries - Max retry attempts (default: 3)
   * @param {Number} options.retryDelay - Delay between retries in ms (default: 2000)
   * 
   * @returns {Promise<Object>} - { statusCode, body }
   */
  static async send(callbackUrl, payload = {}, options = {}) {
    const {
      headers = {},
      timeout = 10000,
      maxRetries = 3,
      retryDelay = 2000
    } = options

    return this._sendWithRetry(callbackUrl, payload, headers, timeout, maxRetries, retryDelay, 0)
  }

  /**
   * Internal method with retry logic
   */
  static async _sendWithRetry(callbackUrl, payload, customHeaders, timeout, maxRetries, retryDelay, attempt = 0) {
    return new Promise((resolve, reject) => {
      try {
        // Parse URL using URL constructor
        const parsedUrl = new URL(callbackUrl)
        
        // Select protocol (http or https)
        const protocol = parsedUrl.protocol === 'https:' ? https : http
        
        // Build full path with query string
        const path = parsedUrl.pathname + parsedUrl.search
        
        // Prepare JSON body
        const jsonBody = JSON.stringify(payload)
        
        // Request options with proper headers
        const requestOptions = {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port,
          path: path,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(jsonBody),
            ...customHeaders
          },
          timeout: timeout
        }

        console.log(`[Webhook] Sending to: ${callbackUrl}`)
        console.log(`[Webhook] Path: ${path}`)
        console.log(`[Webhook] Headers:`, requestOptions.headers)

        const req = protocol.request(requestOptions, (res) => {
          let responseData = ''

          res.on('data', (chunk) => {
            responseData += chunk
          })

          res.on('end', () => {
            console.log(`[Webhook] Response status: ${res.statusCode}`)
            console.log(`[Webhook] Response body (first 200 chars): ${responseData.substring(0, 200)}`)

            if (res.statusCode >= 200 && res.statusCode < 300) {
              console.log('[Webhook] ✓ Success')
              resolve({ statusCode: res.statusCode, body: responseData })
            } else {
              const error = new Error(`Webhook failed with status ${res.statusCode}`)
              if (attempt < maxRetries - 1) {
                console.log(`[Webhook] ⚠ Retrying (${attempt + 2}/${maxRetries})...`)
                setTimeout(() => {
                  this._sendWithRetry(callbackUrl, payload, customHeaders, timeout, maxRetries, retryDelay, attempt + 1)
                    .then(resolve)
                    .catch(reject)
                }, retryDelay)
              } else {
                console.error('[Webhook] ✗ Failed after all retries')
                reject(error)
              }
            }
          })
        })

        req.on('error', (error) => {
          console.error(`[Webhook] ✗ Request error: ${error.message}`)

          if (attempt < maxRetries - 1) {
            console.log(`[Webhook] ⚠ Retrying (${attempt + 2}/${maxRetries})...`)
            setTimeout(() => {
              this._sendWithRetry(callbackUrl, payload, customHeaders, timeout, maxRetries, retryDelay, attempt + 1)
                .then(resolve)
                .catch(reject)
            }, retryDelay)
          } else {
            reject(new Error(`Webhook failed after ${maxRetries} attempts: ${error.message}`))
          }
        })

        req.on('timeout', () => {
          req.abort()
          console.error('[Webhook] ✗ Request timeout')

          if (attempt < maxRetries - 1) {
            console.log(`[Webhook] ⚠ Retrying (${attempt + 2}/${maxRetries})...`)
            setTimeout(() => {
              this._sendWithRetry(callbackUrl, payload, customHeaders, timeout, maxRetries, retryDelay, attempt + 1)
                .then(resolve)
                .catch(reject)
            }, retryDelay)
          } else {
            reject(new Error(`Webhook timeout after ${maxRetries} attempts`))
          }
        })

        // Write JSON body
        req.write(jsonBody)
        req.end()

      } catch (error) {
        console.error(`[Webhook] ✗ Parsing error: ${error.message}`)
        reject(error)
      }
    })
  }
}

module.exports = WebhookSender
