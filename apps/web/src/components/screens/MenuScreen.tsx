'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, UtensilsCrossed, X } from 'lucide-react';
import { Category, Language, PricingMode } from '@eatfit/shared';
import { useMenu, useMenuCombos, useCart, useAddToCart, useSetQuantity } from '@/lib/queries';
import { useAuthStore } from '@/store/auth.store';
import { useUiStore } from '@/store/ui.store';
import { useT, type I18nKey } from '@/lib/i18n';
import { formatMoney, menuPhotoUrl, pick } from '@/lib/format';
import { haptic } from '@/lib/telegram';
import { Stepper } from '@/components/Stepper';
import {
  Button,
  EmptyState,
  MenuSkeleton,
  PriceTag,
  SectionHeader,
  BottomSheet,
} from '@/components/consumer';
import { MenuItemDto } from '@/lib/types';

const CATS: { cat: Category; key: I18nKey; sectionId: string }[] = [
  { cat: Category.Main, key: 'cat_main', sectionId: 'section-main' },
  { cat: Category.Drink, key: 'cat_drink', sectionId: 'section-drink' },
  { cat: Category.Dessert, key: 'cat_dessert', sectionId: 'section-dessert' },
];

type Chip = { id: string; key: I18nKey };

export function MenuScreen() {
  const t = useT();
  const lang = useAuthStore((s) => s.client?.language ?? Language.Ru);
  const openDetail = useUiStore((s) => s.openDetail);
  const openCombo = useUiStore((s) => s.openCombo);
  const setTab = useUiStore((s) => s.setTab);
  const { data: menu, isLoading } = useMenu();
  const { data: combos } = useMenuCombos();
  const { data: cart } = useCart();
  const add = useAddToCart();
  const setQty = useSetQuantity();
  const busy = add.isPending || setQty.isPending;
  const [q, setQ] = useState('');
  const [activeChip, setActiveChip] = useState('section-combo');
  const [chooseFor, setChooseFor] = useState<MenuItemDto | null>(null);
  const [selPortion, setSelPortion] = useState<Record<string, number>>({});
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const scrollingRef = useRef(false);

  const activeCombos = useMemo(() => (combos ?? []).filter((c) => c.isActive), [combos]);
  const needle = q.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!menu?.length) return [];
    if (!needle) return menu;
    return menu.filter((i) => `${i.nameRu} ${i.nameUz}`.toLowerCase().includes(needle));
  }, [menu, needle]);

  const filteredCombos = useMemo(() => {
    if (!needle) return activeCombos;
    return activeCombos.filter((c) => `${c.nameRu} ${c.nameUz}`.toLowerCase().includes(needle));
  }, [activeCombos, needle]);

  const chips: Chip[] = useMemo(() => {
    const list: Chip[] = [];
    if (filteredCombos.length) list.push({ id: 'section-combo', key: 'cat_specials' });
    for (const { sectionId, key } of CATS) {
      if (filtered.some((i) => i.category === CATS.find((c) => c.sectionId === sectionId)?.cat)) {
        list.push({ id: sectionId, key });
      }
    }
    return list;
  }, [filtered, filteredCombos.length]);

  useEffect(() => {
    if (!chips.length) return;
    if (!chips.some((c) => c.id === activeChip)) {
      setActiveChip(chips[0].id);
    }
  }, [chips, activeChip]);

  useEffect(() => {
    const ids = chips.map((c) => c.id);
    if (!ids.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (scrollingRef.current) return;
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target.id) {
          setActiveChip(visible[0].target.id);
        }
      },
      { rootMargin: '-120px 0px -55% 0px', threshold: 0.1 },
    );

    for (const id of ids) {
      const el = sectionRefs.current[id];
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [chips, filtered.length, filteredCombos.length]);

  const scrollToSection = (id: string) => {
    haptic('selection');
    setActiveChip(id);
    scrollingRef.current = true;
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => {
      scrollingRef.current = false;
    }, 600);
  };

  const portionOf = (id: string) => selPortion[id] ?? 1;

  const needsDetail = (item: MenuItemDto) =>
    item.pricingMode === PricingMode.PerUnit ||
    item.hasRequiredModifiers === true ||
    item.hasModifierGroups === true;

  const qtyOf = (id: string) =>
    cart?.items.find(
      (i) =>
        i.kind === 'dish' &&
        i.menuItemId === id &&
        i.portion === portionOf(id) &&
        i.modifiers.length === 0,
    )?.quantity ?? 0;

  const change = (item: MenuItemDto, nextQty: number) => {
    if (needsDetail(item)) {
      openDetail(item.id);
      return;
    }
    const portion = portionOf(item.id);
    if (nextQty <= 0) {
      setQty.mutate({ menuItemId: item.id, quantity: 0, portion });
      return;
    }
    if (qtyOf(item.id) === 0) {
      if (item.price2 != null) setChooseFor(item);
      else add.mutate({ menuItemId: item.id, portion: 1 });
      return;
    }
    setQty.mutate({ menuItemId: item.id, quantity: nextQty, portion });
  };

  const pickPortion = (portion: number) => {
    if (!chooseFor) return;
    haptic('light');
    const id = chooseFor.id;
    setSelPortion((m) => ({ ...m, [id]: portion }));
    add.mutate({ menuItemId: id, portion });
    setChooseFor(null);
  };

  const portionLabel = (p: number, w: number | null, price: string) =>
    `${w != null ? `${w} ${t('unit_gram')}` : `${t('portion')} ${p}`} · ${formatMoney(price)} ${t('currency')}`;

  const cartCount = cart?.items.reduce((sum, i) => sum + i.quantity, 0) ?? 0;
  const cartTotal = cart?.total;

  const setSectionRef = useCallback(
    (id: string) => (el: HTMLElement | null) => {
      sectionRefs.current[id] = el;
    },
    [],
  );

  if (isLoading) return <MenuSkeleton />;

  if (!menu?.length) {
    return (
      <EmptyState icon={UtensilsCrossed} title={t('menu_empty')} />
    );
  }

  const renderDish = (item: MenuItemDto) => {
    const name = pick(lang, item.nameRu, item.nameUz);
    const desc = pick(lang, item.descriptionRu, item.descriptionUz);
    return (
      <article className="menu-card" key={item.id}>
        {item.hasPhoto ? (
          <div
            className="menu-card-media-wrap"
            onClick={() => openDetail(item.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && openDetail(item.id)}
            aria-label={name}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="menu-card-media" src={menuPhotoUrl(item.id)} alt={name} loading="lazy" />
            <div className="menu-card-media-gradient" aria-hidden />
          </div>
        ) : null}
        <div className="menu-card-body">
          <div
            className="menu-card-name"
            onClick={() => openDetail(item.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && openDetail(item.id)}
          >
            {name}
          </div>
          {desc ? <div className="menu-card-desc">{desc}</div> : null}
          <div className="menu-card-footer">
            <PriceTag amount={item.price} className="menu-card-price" />
            <Stepper
              qty={qtyOf(item.id)}
              busy={busy}
              addLabel={t('add')}
              onChange={(next) => change(item, next)}
            />
          </div>
          {needsDetail(item) ? (
            <button type="button" className="dish-more" onClick={() => openDetail(item.id)}>
              {t('detail_open')} →
            </button>
          ) : null}
        </div>
      </article>
    );
  };

  return (
    <div>
      <SectionHeader title={t('nav_menu')}>
        <div className="search-wrap">
          <Search className="search-icon" size={18} aria-hidden />
          <input
            className="input search-input"
            placeholder={t('search_ph')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label={t('search_ph')}
          />
          {q ? (
            <button
              type="button"
              className="search-clear"
              aria-label={t('clear_search')}
              onClick={() => setQ('')}
            >
              <X size={18} />
            </button>
          ) : null}
        </div>
        {chips.length > 1 && !needle ? (
          <div className="cat-chips" role="tablist" aria-label={t('nav_menu')}>
            {chips.map(({ id, key }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={activeChip === id}
                className={`cat-chip${activeChip === id ? ' active' : ''}`}
                onClick={() => scrollToSection(id)}
              >
                {t(key)}
              </button>
            ))}
          </div>
        ) : null}
      </SectionHeader>

      {needle && !filtered.length && !filteredCombos.length ? (
        <EmptyState icon={Search} title={t('nothing_found')} subtitle={t('search_ph')} />
      ) : null}

      {filteredCombos.length > 0 ? (
        <section
          id="section-combo"
          className="menu-section"
          ref={setSectionRef('section-combo')}
        >
          <div className="cat-title">{t('cat_specials')}</div>
          {filteredCombos.map((c) => (
            <article className="menu-card" key={c.id}>
              {c.photoUrl ? (
                <div
                  className="menu-card-media-wrap"
                  onClick={() => openCombo(c.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && openCombo(c.id)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className="menu-card-media"
                    src={c.photoUrl}
                    alt={pick(lang, c.nameRu, c.nameUz)}
                    loading="lazy"
                  />
                  <span className="menu-card-badge">{t('cat_combo')}</span>
                  <div className="menu-card-media-gradient" aria-hidden />
                </div>
              ) : null}
              <div className="menu-card-body">
                <div className="menu-card-name" onClick={() => openCombo(c.id)} role="presentation">
                  {pick(lang, c.nameRu, c.nameUz)}
                </div>
                {pick(lang, c.descriptionRu, c.descriptionUz) ? (
                  <div className="menu-card-desc">
                    {pick(lang, c.descriptionRu, c.descriptionUz)}
                  </div>
                ) : null}
                <div className="menu-card-footer">
                  <PriceTag amount={c.price} original={c.originalPrice} className="menu-card-price" />
                  <Button variant="primary" size="pill" onClick={() => openCombo(c.id)}>
                    {t('detail_open')}
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : null}

      {CATS.map(({ cat, key, sectionId }) => {
        const items = filtered.filter((i) => i.category === cat);
        if (!items.length) return null;
        return (
          <section id={sectionId} className="menu-section" key={cat} ref={setSectionRef(sectionId)}>
            <div className="cat-title">{t(key)}</div>
            {items.map(renderDish)}
          </section>
        );
      })}

      {cartCount > 0 && cartTotal ? (
        <button
          type="button"
          className="floating-cart"
          onClick={() => {
            haptic('medium');
            setTab('cart');
          }}
        >
          <span>
            {t('view_cart')} · <span className="floating-cart-count">{cartCount}</span>
          </span>
          <PriceTag amount={cartTotal} />
        </button>
      ) : null}

      <BottomSheet
        open={chooseFor != null}
        onOpenChange={(open) => !open && setChooseFor(null)}
        title={t('portion_choose')}
      >
        {chooseFor ? (
          <div className="modal-portions">
            <Button busy={busy} onClick={() => pickPortion(1)}>
              {portionLabel(1, chooseFor.weightGrams, chooseFor.price)}
            </Button>
            <Button busy={busy} onClick={() => pickPortion(2)}>
              {portionLabel(2, chooseFor.weightGrams2, chooseFor.price2 as string)}
            </Button>
          </div>
        ) : null}
      </BottomSheet>
    </div>
  );
}
