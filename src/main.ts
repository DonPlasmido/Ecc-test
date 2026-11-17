import './styles.css'
import { registerSW } from 'virtual:pwa-register'
import { h, backLink } from './ui/dom'
import { tools } from './ui/tools'

const app = document.querySelector<HTMLElement>('#app')!

function renderHome(): void {
  app.replaceChildren(
    h('h1', {}, '¿Qué quieres hacer?'),
    h('p', { class: 'lead' }, 'Tus archivos se procesan en este dispositivo. No se suben a ningún sitio.'),
    tools.length === 0
      ? h('p', { class: 'hint' }, 'Todavía no hay herramientas.')
      : h('nav', { class: 'tools' },
          ...tools.map((t) =>
            h('a', { class: 'tool', href: `#${t.id}` }, h('strong', {}, t.title), h('span', {}, t.description)),
          ),
        ),
  )
}

async function route(): Promise<void> {
  const id = location.hash.slice(1)
  const tool = tools.find((t) => t.id === id)
  if (!tool) return renderHome()
  app.replaceChildren(backLink(), h('h1', {}, tool.title), h('p', { class: 'lead' }, tool.description))
  const { render } = await tool.load()
  render(app)
  window.scrollTo(0, 0)
}

window.addEventListener('hashchange', () => void route())
void route()
registerSW({ immediate: true })
