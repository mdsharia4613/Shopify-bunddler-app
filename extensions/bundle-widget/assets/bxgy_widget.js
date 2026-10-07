/**
 * Buy X, Get Y (BXGY) Storefront Widget
 * Dynamic sync with /api/bundles, quantity sync, and default theme Add-To-Cart interception
 */
(function() {
  function initBxgyWidgets() {
    const containers = document.querySelectorAll('.bxgy-widget-container[data-bxgy-widget]');
    containers.forEach(container => {
      if (container.dataset.bxgyInitialized) return;
      container.dataset.bxgyInitialized = 'true';

      const blockId = container.getAttribute('data-block-id');
      const productId = container.getAttribute('data-product-id');
      let currentVariantId = container.getAttribute('data-variant-id');
      let basePrice = parseInt(container.getAttribute('data-base-price'), 10) || 0;
      const currency = container.getAttribute('data-currency') || '$';
      const currentProductTitle = container.getAttribute('data-product-title') || '';
      let currentProductImage = container.getAttribute('data-product-image') || '';

      function formatMoney(cents) {
        return currency + (cents / 100).toFixed(2);
      }

      function syncThemeQuantity(qty) {
        const qtyInputs = document.querySelectorAll('input[name="quantity"], input.quantity__input, [data-quantity-input]');
        qtyInputs.forEach(qtyInput => {
          if (qtyInput) {
            qtyInput.value = qty;
            qtyInput.dispatchEvent(new Event('change', { bubbles: true }));
            qtyInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
        });
      }

      function bindTierEvents() {
        const tiers = container.querySelectorAll('.bxgy-tier-row');
        tiers.forEach(item => {
          item.onclick = function() {
            selectTier(this);
          };
          item.onkeydown = function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              selectTier(this);
            }
          };
        });
      }

      function selectTier(item, skipQtySync) {
        const tiers = container.querySelectorAll('.bxgy-tier-row');
        tiers.forEach(t => {
          t.classList.remove('is-selected');
          t.setAttribute('aria-checked', 'false');
          const card = t.closest('.bxgy-tier-card');
          if (card) card.classList.remove('is-selected');
        });

        item.classList.add('is-selected');
        item.setAttribute('aria-checked', 'true');
        const activeCard = item.closest('.bxgy-tier-card');
        if (activeCard) activeCard.classList.add('is-selected');

        const qty = parseInt(item.getAttribute('data-qty') || '1', 10);
        if (!skipQtySync) {
          syncThemeQuantity(qty);
        }
      }

      bindTierEvents();

      const initiallySelected = container.querySelector('.bxgy-tier-row.is-selected') || container.querySelector('.bxgy-tier-row');
      if (initiallySelected) {
        selectTier(initiallySelected);
      }

      // Dynamic Price update on variant changes
      document.addEventListener('variant:change', function(evt) {
        if (evt.detail && evt.detail.variant) {
          currentVariantId = evt.detail.variant.id;
          basePrice = evt.detail.variant.price;
          if (evt.detail.variant.featured_image && evt.detail.variant.featured_image.src) {
            currentProductImage = evt.detail.variant.featured_image.src;
          }
          updateTierPrices();
        }
      });

      function updateTierPrices() {
        const tiers = container.querySelectorAll('.bxgy-tier-row');
        tiers.forEach(item => {
          const tierNum = item.getAttribute('data-tier');
          const qty = parseInt(item.getAttribute('data-qty') || '1', 10);
          const discount = parseFloat(item.getAttribute('data-discount') || '0');

          const rawCents = basePrice * qty;
          const savedCents = Math.round(rawCents * (discount / 100));
          const finalCents = rawCents - savedCents;

          const finalPriceEl = item.querySelector('[data-final-price="' + tierNum + '"]');
          if (finalPriceEl) finalPriceEl.textContent = formatMoney(finalCents);

          const rawPriceEl = item.querySelector('[data-raw-price="' + tierNum + '"]');
          if (rawPriceEl) {
            if (discount > 0) {
              rawPriceEl.style.display = 'block';
              rawPriceEl.textContent = formatMoney(rawCents);
            } else {
              rawPriceEl.style.display = 'none';
            }
          }
        });
      }

      // Client-side dynamic tier sync from App API
      async function syncTiersFromApi() {
        try {
          const res = await fetch('/api/bundles');
          if (!res.ok) return;
          const data = await res.json();
          if (!data || !data.bundles) return;

          const bxgyBundles = data.bundles.filter(b => b.strategy === 'Buy X Get Y' && b.status === 'Active');
          if (bxgyBundles.length === 0) return;
          const activeConfig = bxgyBundles[0].config;
          if (!activeConfig || !activeConfig.tiers || activeConfig.tiers.length === 0) return;

          // Check eligibility
          if (activeConfig.appliesTo === 'products' && activeConfig.selectedProducts && activeConfig.selectedProducts.length > 0) {
            const matchesProduct = activeConfig.selectedProducts.some(p => {
              const cleanId = String(p.id).split('/').pop();
              return cleanId === productId;
            });
            if (!matchesProduct) return;
          }

          // Update Header Title & Accent Color dynamically
          if (activeConfig.headerTitle) {
            const mainTitle = container.querySelector('.bxgy-main-title');
            if (mainTitle) mainTitle.textContent = activeConfig.headerTitle;
          }
          if (activeConfig.accentColor) {
            container.style.setProperty('--bxgy-accent', activeConfig.accentColor);
          }

          renderDynamicTiers(activeConfig);
        } catch(e) {
          console.warn('BXGY dynamic sync info:', e);
        }
      }

      function renderDynamicTiers(config) {
        const tiersList = container.querySelector('.bxgy-tiers-list');
        if (!tiersList) return;

        const defaultTierIndex = config.defaultTier || 1;
        let html = '';

        config.tiers.forEach((tier, idx) => {
          const tierNum = idx + 1;
          const isSelected = tierNum === defaultTierIndex;
          const buyQty = parseInt(tier.buyQty || '1', 10);
          const getQty = parseInt(tier.getQty !== undefined ? tier.getQty : '0', 10);
          const totalQty = parseInt(tier.totalQty || (buyQty + getQty) || '1', 10);
          const discount = parseFloat(tier.discount || '0');
          const rawCents = basePrice * totalQty;
          const savedCents = Math.round(rawCents * (discount / 100));
          const finalCents = rawCents - savedCents;

          let popBadgeHtml = '';
          if (tier.popularBadge && tier.popularBadge.trim() !== '') {
            popBadgeHtml = '<div class="bxgy-popular-badge"><span>Ã¢Å¡Â¡</span><span>' + tier.popularBadge + '</span></div>';
          }

          let subtext = '';
          if (getQty > 0) {
            subtext = buyQty + ' Paid + ' + getQty + ' Free (' + totalQty + ' total items)';
          } else {
            subtext = buyQty + ' Item' + (buyQty > 1 ? 's' : '') + ' (Standard)';
          }

          let saveTagHtml = '';
          if (discount > 0) {
            if (tier.saveTag && tier.saveTag.trim() !== '') {
              saveTagHtml = '<span class="bxgy-save-tag">' + tier.saveTag + '</span>';
            } else {
              saveTagHtml = '<span class="bxgy-save-tag">SAVE ' + discount + '%</span>';
            }
          }

          let strikethroughHtml = '';
          if (discount > 0) {
            strikethroughHtml = '<div class="bxgy-raw-price" data-raw-price="' + tierNum + '">' + formatMoney(rawCents) + '</div>';
          }

          html += `
            <div class="bxgy-tier-card ${isSelected ? 'is-selected' : ''}" data-tier-card="${tierNum}">
              <div
                class="bxgy-tier-row ${isSelected ? 'is-selected' : ''}"
                data-tier="${tierNum}"
                data-qty="${totalQty}"
                data-buy-qty="${buyQty}"
                data-get-qty="${getQty}"
                data-discount="${discount}"
                data-title="${tier.title || 'Buy X Get Y Deal'}"
                tabindex="0"
                role="radio"
                aria-checked="${isSelected ? 'true' : 'false'}"
              >
                ${popBadgeHtml}
                <div class="bxgy-tier-left">
                  <span class="bxgy-radio-dot"></span>
                  <div class="bxgy-tier-info">
                    <span class="bxgy-tier-title">${tier.title || 'Buy X Get Y'}</span>
                    <span class="bxgy-tier-subtext">${subtext}</span>
                  </div>
                </div>
                <div class="bxgy-tier-right">
                  ${saveTagHtml}
                  <div class="bxgy-final-price" data-final-price="${tierNum}">
                    ${formatMoney(finalCents)}
                  </div>
                  ${strikethroughHtml}
                </div>
              </div>
            </div>
          `;
        });

        tiersList.innerHTML = html;
        bindTierEvents();

        const activeTier = container.querySelector('.bxgy-tier-row.is-selected') || container.querySelector('.bxgy-tier-row');
        if (activeTier) {
          selectTier(activeTier);
        }
      }

      syncTiersFromApi();

      let isSubmitting = false;

      async function handleBxgyAddToCart(triggerBtn) {
        if (isSubmitting) return;

        const selected = container.querySelector('.bxgy-tier-row.is-selected');
        if (!selected) return;

        const qty = parseInt(selected.getAttribute('data-qty') || '1', 10);
        const buyQty = parseInt(selected.getAttribute('data-buy-qty') || '1', 10);
        const getQty = parseInt(selected.getAttribute('data-get-qty') || '0', 10);
        const discount = parseFloat(selected.getAttribute('data-discount') || '0');
        const tierTitle = selected.getAttribute('data-title') || 'Buy X Get Y Deal';

        isSubmitting = true;

        const themeBtn = triggerBtn || document.querySelector('form[action*="/cart/add"] button[type="submit"], form[action*="/cart/add"] [name="add"], .product-form__submit');
        let originalBtnHtml = '';
        if (themeBtn) {
          originalBtnHtml = themeBtn.innerHTML;
          themeBtn.setAttribute('aria-disabled', 'true');
          themeBtn.disabled = true;
          themeBtn.classList.add('loading');
          const btnSpan = themeBtn.querySelector('span:not(.loader)') || themeBtn;
          if (btnSpan && btnSpan.textContent) {
            btnSpan.textContent = 'Adding deal...';
          }
        }

        try {
          const rawCents = basePrice * qty;
          const savedCents = Math.round(rawCents * (discount / 100));
          const finalCents = rawCents - savedCents;

          let items = [];
          const discountCode = 'BXGY' + Math.round(discount);
          if (discount > 0) {
            const bundleGroupId = 'bxgy_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
            const parentVarGid = 'gid://shopify/ProductVariant/' + currentVariantId;
            const fullTitle = currentProductTitle + ' (' + tierTitle + ')';
            const componentsText = getQty > 0
              ? currentProductTitle + ' x ' + qty + ' (' + buyQty + ' Paid + ' + getQty + ' Free)'
              : currentProductTitle + ' x ' + qty;

            items.push({
              id: parseInt(currentVariantId, 10),
              quantity: qty,
              properties: {
                '_bundle': 'Buy X Get Y',
                '_bundle_type': 'bxgy',
                '_bundle_group': bundleGroupId,
                '_bundle_title': fullTitle,
                '_bundle_components': componentsText,
                '_bundle_discount': discount + '%',
                '_bundle_discount_num': discount.toString(),
                '_bundle_discount_code': discountCode,
                '_bundle_original_cents': rawCents.toString(),
                '_bundle_discounted_cents': finalCents.toString(),
                '_bundle_image': currentProductImage || '',
                '_bundle_parent_variant_id': parentVarGid,
                '_volume_tier': tierTitle
              }
            });
          } else {
            items.push({
              id: parseInt(currentVariantId, 10),
              quantity: qty
            });
          }

          const response = await fetch('/cart/add.js', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({ items })
          });

          if (response.ok) {
            setTimeout(function() {
              window.location.href = '/cart';
            }, 250);
          } else {
            const err = await response.json();
            throw new Error(err.description || 'Could not add deal to cart.');
          }
        } catch (err) {
          isSubmitting = false;
          if (themeBtn) {
            themeBtn.removeAttribute('aria-disabled');
            themeBtn.disabled = false;
            themeBtn.classList.remove('loading');
            if (originalBtnHtml) themeBtn.innerHTML = originalBtnHtml;
          }
          alert(err.message || 'Error adding deal.');
        }
      }

      function interceptDefaultAddToCart() {
        document.addEventListener('submit', function(e) {
          const form = e.target.closest('form[action*="/cart/add"]');
          if (!form) return;

          const selected = container.querySelector('.bxgy-tier-row.is-selected');
          if (!selected) return;

          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          const btn = form.querySelector('button[type="submit"], [name="add"], .product-form__submit');
          handleBxgyAddToCart(btn);
          return false;
        }, true);

        document.addEventListener('click', function(e) {
          const btn = e.target.closest('button[type="submit"][name="add"], .product-form__submit, [name="add"], button[name="add"], .btn--add-to-cart');
          if (!btn) return;

          const selected = container.querySelector('.bxgy-tier-row.is-selected');
          if (!selected) return;

          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          handleBxgyAddToCart(btn);
          return false;
        }, true);
      }

      interceptDefaultAddToCart();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBxgyWidgets);
  } else {
    initBxgyWidgets();
  }
})();
