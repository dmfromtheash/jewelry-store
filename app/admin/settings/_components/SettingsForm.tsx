/**
 * AURELIA — Admin site-settings form (Этап 46C)
 *
 * Server-rendered, no client JS — posts to updateSiteSettingsAction. Built only
 * from the EXISTING admin/auth UI primitives (.au-adm-card / .au-adm-section-title
 * / .au-field / .au-adm-form / .au-btn); it adds NO new CSS and does NOT touch the
 * storefront. Fields are grouped (Бренд / Контакты / Соцсети / Футер) and rendered
 * straight from the server-loaded settings view.
 */

import type { SiteSettingView } from '../../../../src/lib/site-settings/server'
import {
  SITE_SETTING_GROUPS,
  SITE_SETTING_GROUP_LABELS,
  type SiteSettingGroup,
} from '../../../../src/lib/site-settings/defaults'
import { updateSiteSettingsAction } from '../../../../src/lib/admin/settings-actions'

/** Maps a setting type to a sensible HTML input type (long_text → textarea). */
function inputType(type: SiteSettingView['type']): string {
  switch (type) {
    case 'email':
      return 'email'
    case 'url':
      return 'url'
    case 'phone':
      return 'tel'
    default:
      return 'text'
  }
}

function Field({ setting }: { setting: SiteSettingView }) {
  const id = `au-set-${setting.key.replace(/\./g, '-')}`
  const labelText = setting.optional ? setting.label : `${setting.label} *`
  return (
    <div className="au-field">
      <label htmlFor={id}>{labelText}</label>
      {setting.type === 'long_text' ? (
        <textarea
          id={id}
          name={setting.key}
          rows={3}
          maxLength={setting.maxLength}
          required={!setting.optional}
          placeholder={setting.hint}
          defaultValue={setting.value}
        />
      ) : (
        <input
          id={id}
          name={setting.key}
          type={inputType(setting.type)}
          maxLength={setting.maxLength}
          required={!setting.optional}
          placeholder={setting.hint}
          defaultValue={setting.value}
        />
      )}
    </div>
  )
}

export function SettingsForm({ settings }: { settings: SiteSettingView[] }) {
  const byGroup = (group: SiteSettingGroup) => settings.filter((s) => s.group === group)

  return (
    <form action={updateSiteSettingsAction} className="au-adm-form au-adm-card">
      {SITE_SETTING_GROUPS.map((group) => {
        const items = byGroup(group)
        if (items.length === 0) return null
        return (
          <section key={group}>
            <h2 className="au-adm-section-title">{SITE_SETTING_GROUP_LABELS[group]}</h2>
            {items.map((s) => (
              <Field key={s.key} setting={s} />
            ))}
          </section>
        )
      })}

      <div className="au-adm-form-actions">
        <button className="au-btn au-btn--primary" type="submit">
          Сохранить настройки
        </button>
      </div>
    </form>
  )
}
