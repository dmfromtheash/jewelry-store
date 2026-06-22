/**
 * AURELIA — Admin customer detail / support summary (Этап 68A)
 *
 * Local/dev-only customer support view (guarded). READ-ONLY: shows the profile, safe counts,
 * recent orders/reviews/wishlist, email-outbox SAFE metadata, account-token COUNTS, and the
 * derived support indicators. No edit/delete/impersonate, no token values, no password hash,
 * no email body. Links out to the existing admin order/review/catalog screens. noindex.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ensureLocalAdmin } from '../../../../src/lib/admin/guard'
import { requireAdminSession } from '../../../../src/lib/admin/auth'
import { getAdminCustomerDetail } from '../../../../src/lib/admin/customers'
import { ORDER_STATUS_LABELS } from '../../../../src/lib/admin/orders'
import { REVIEW_STATUS_LABELS } from '../../../../src/lib/admin/reviews'
import { deliveryMethodLabel } from '../../../../src/lib/orders/methods'
import { formatPrice } from '../../../../src/lib/catalog'
import {
  SUPPORT_SEVERITY_LABELS,
  type SupportSeverity,
} from '../../../../src/lib/admin/customer-support'

export const metadata: Metadata = {
  title: 'Админ · Покупатель — AURELIA',
  robots: { index: false, follow: false },
}

const dateFmt = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' })
const dayFmt = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium' })
const money = (minor: number) => formatPrice(minor / 100)

const SEVERITY_BADGE: Record<SupportSeverity, string> = {
  action: 'au-adm-badge--action',
  warn: 'au-adm-badge--warn',
  info: 'au-adm-badge--info',
}

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ customerId: string }>
}) {
  await ensureLocalAdmin()
  await requireAdminSession()

  const { customerId } = await params
  const data = await getAdminCustomerDetail(decodeURIComponent(customerId))
  if (!data) notFound()

  const { profile, counts, recentOrders, reviews, wishlist, recentEmail, indicators } = data

  return (
    <div className="au-container au-adm">
      <div className="au-adm-head">
        <div>
          <Link className="au-adm-link" href="/admin/customers">
            ← Все покупатели
          </Link>
          <h1 className="au-adm-title">{profile.name ?? profile.email}</h1>
          <span className="au-adm-sub">ID {profile.shortId} · {profile.email}</span>
        </div>
        {profile.emailVerified ? (
          <span className="au-adm-badge au-adm-badge--approved">E-mail подтверждён</span>
        ) : (
          <span className="au-adm-badge au-adm-badge--pending">E-mail не подтверждён</span>
        )}
      </div>

      {/* ---- Support indicators ---- */}
      <h2 className="au-adm-section-title">Поддержка</h2>
      <div className="au-adm-card">
        {indicators.length === 0 ? (
          <p className="au-adm-note">Особых сигналов нет — аккаунт в порядке.</p>
        ) : (
          <ul className="au-adm-feed">
            {indicators.map((i) => (
              <li key={i.key} className="au-adm-feed-row">
                <span className="au-adm-feed-main">
                  <span className={`au-adm-badge ${SEVERITY_BADGE[i.severity]}`}>
                    {SUPPORT_SEVERITY_LABELS[i.severity]}
                  </span>{' '}
                  {i.label}
                </span>
                <span className="au-adm-feed-aside">
                  <Link className="au-adm-link" href={i.href}>
                    Открыть →
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="au-adm-grid">
        {/* Left: orders, reviews, wishlist, email */}
        <div>
          {/* Orders */}
          <div className="au-adm-card">
            <h2 className="au-adm-card-title">Заказы ({counts.orders})</h2>
            {recentOrders.length === 0 ? (
              <p className="au-adm-note">У покупателя пока нет заказов.</p>
            ) : (
              <div className="au-adm-tablewrap">
                <table className="au-adm-table">
                  <thead>
                    <tr>
                      <th>Номер</th>
                      <th>Статус</th>
                      <th>Доставка</th>
                      <th>Сумма</th>
                      <th>Создан</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.map((o) => (
                      <tr key={o.orderCode}>
                        <td>
                          <Link className="au-adm-link" href={`/admin/orders/${o.orderCode}`}>
                            {o.orderCode}
                          </Link>
                        </td>
                        <td>
                          <span className={`au-adm-badge au-adm-badge--${o.status}`}>
                            {ORDER_STATUS_LABELS[o.status]}
                          </span>
                        </td>
                        <td>
                          {o.deliveryCity} · {deliveryMethodLabel(o.deliveryMethod)}
                          {(o.deliveryBranch || o.deliveryComment) && (
                            <span className="au-adm-sub"> · ручная</span>
                          )}
                        </td>
                        <td>
                          {money(o.totalAmount)}
                          {o.discountMinor > 0 && (
                            <span className="au-adm-sub"> · −{money(o.discountMinor)}{o.promoCode ? ` (${o.promoCode})` : ''}</span>
                          )}
                        </td>
                        <td>{dayFmt.format(o.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {counts.orders > recentOrders.length && (
              <p className="au-adm-cta">
                <Link className="au-adm-link" href="/admin/orders">Все заказы →</Link>
              </p>
            )}
          </div>

          {/* Reviews */}
          <div className="au-adm-card">
            <h2 className="au-adm-card-title">Отзывы ({counts.reviews})</h2>
            {reviews.length === 0 ? (
              <p className="au-adm-note">Покупатель не оставлял отзывов.</p>
            ) : (
              <ul className="au-adm-feed">
                {reviews.map((r) => (
                  <li key={r.id} className="au-adm-feed-row">
                    <span className="au-adm-feed-main">
                      <Link className="au-adm-link" href={`/product/${r.product.slug}`}>
                        {r.product.name}
                      </Link>
                      <span className="au-adm-feed-meta"> · {'★'.repeat(r.rating)}</span>
                    </span>
                    <span className="au-adm-feed-aside">
                      <span className={`au-adm-badge au-adm-badge--${r.status}`}>
                        {REVIEW_STATUS_LABELS[r.status]}
                      </span>
                      <span className="au-adm-feed-time">{dayFmt.format(r.createdAt)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="au-adm-cta">
              <Link className="au-adm-link" href="/admin/reviews">Модерация отзывов →</Link>
            </p>
          </div>

          {/* Wishlist */}
          <div className="au-adm-card">
            <h2 className="au-adm-card-title">Избранное ({counts.wishlist})</h2>
            {wishlist.length === 0 ? (
              <p className="au-adm-note">Список избранного пуст.</p>
            ) : (
              <ul className="au-adm-feed">
                {wishlist.map((w) => (
                  <li key={w.slug} className="au-adm-feed-row">
                    <span className="au-adm-feed-main">
                      <Link className="au-adm-link" href={`/product/${w.slug}`}>{w.name}</Link>
                    </span>
                    <span className="au-adm-feed-aside">
                      {w.available ? (
                        <span className="au-adm-badge au-adm-badge--approved">В продаже</span>
                      ) : (
                        <span className="au-adm-badge au-adm-badge--pending">Недоступен</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Email / support */}
          <div className="au-adm-card">
            <h2 className="au-adm-card-title">Письма (outbox) ({counts.emailEvents})</h2>
            <p className="au-adm-note">
              Реальная отправка e-mail НЕ настроена (нет провайдера) — письма только фиксируются.
              Показаны только безопасные метаданные: шаблон, статус, связь и дата. Текст письма,
              адрес и токены не хранятся/не показываются.
            </p>
            {recentEmail.length === 0 ? (
              <p className="au-adm-note">Событий по письмам нет.</p>
            ) : (
              <ul className="au-adm-feed">
                {recentEmail.map((e) => (
                  <li key={e.id} className="au-adm-feed-row">
                    <span className="au-adm-feed-main">
                      {e.template}
                      <span className="au-adm-feed-meta"> · {e.relatedType ?? '—'}: {e.relatedId ?? '—'}</span>
                    </span>
                    <span className="au-adm-feed-aside">
                      <span className={`au-adm-badge au-adm-badge--${e.status}`}>{e.status}</span>
                      <span className="au-adm-feed-time">{dayFmt.format(e.createdAt)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="au-adm-cta">
              <Link className="au-adm-link" href="/admin/email-outbox">Все письма →</Link>
            </p>
          </div>
        </div>

        {/* Right: profile + counts + tokens */}
        <aside className="au-adm-aside">
          <div className="au-adm-card">
            <h2 className="au-adm-card-title">Профиль</h2>
            <dl className="au-adm-dl">
              <dt>ID</dt>
              <dd>{profile.shortId}</dd>
              <dt>E-mail</dt>
              <dd>{profile.email}</dd>
              <dt>Имя</dt>
              <dd>{profile.name ?? '—'}</dd>
              <dt>Телефон</dt>
              <dd>{profile.phone ?? '—'}</dd>
              <dt>E-mail подтверждён</dt>
              <dd>{profile.emailVerifiedAt ? dateFmt.format(profile.emailVerifiedAt) : 'нет'}</dd>
              <dt>Регистрация</dt>
              <dd>{dateFmt.format(profile.createdAt)}</dd>
              <dt>Смена пароля</dt>
              <dd>{profile.passwordChangedAt ? dateFmt.format(profile.passwordChangedAt) : '—'}</dd>
              <dt>Версия сессии</dt>
              <dd>{profile.sessionVersion}</dd>
            </dl>
            <p className="au-adm-note">
              Пароль хранится только в виде защищённого хэша и здесь не показывается.
            </p>
          </div>

          <div className="au-adm-card">
            <h2 className="au-adm-card-title">Счётчики</h2>
            <dl className="au-adm-dl">
              <dt>Заказы</dt>
              <dd>{counts.orders}</dd>
              <dt>Отзывы</dt>
              <dd>{counts.reviews}</dd>
              <dt>Избранное</dt>
              <dd>{counts.wishlist}</dd>
              <dt>События писем</dt>
              <dd>{counts.emailEvents}</dd>
            </dl>
          </div>

          <div className="au-adm-card">
            <h2 className="au-adm-card-title">Токены доступа</h2>
            <dl className="au-adm-dl">
              <dt>Всего токенов</dt>
              <dd>{counts.tokensTotal}</dd>
              <dt>Активные: сброс пароля</dt>
              <dd>{counts.tokensLiveReset}</dd>
              <dt>Активные: подтверждение e-mail</dt>
              <dd>{counts.tokensLiveVerify}</dd>
            </dl>
            <p className="au-adm-note">
              Показаны только количества и статус. Значения токенов хранятся в виде хэша и никогда
              не отображаются.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
