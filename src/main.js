import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { t } from './i18n/index.js'

const app = createApp(App)
app.config.globalProperties.t = t // t('key') usable in every template
app.mount('#app')
