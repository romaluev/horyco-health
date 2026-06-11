import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Composer, type Context } from 'telegraf';
import { ClientUpdate } from '../updates/client.update';
import { StaffUpdate } from '../updates/staff.update';

/**
 * Единый Composer для всех бизнес-ботов. Порядок регистрации зеркалит nestjs-telegraf:
 * клиентские хендлеры → text-router с next() для /команд → staff commands/actions.
 *
 * ClientUpdate/StaffUpdate резолвятся через ModuleRef в create(), а не в конструкторе —
 * иначе цикл ClientUpdate → OffersService → BroadcastService → BotRegistryService → … deadlock.
 */
@Injectable()
export class BotComposerFactory {
  constructor(private readonly moduleRef: ModuleRef) {}

  create(): Composer<Context> {
    const c = this.moduleRef.get(ClientUpdate, { strict: false });
    const s = this.moduleRef.get(StaffUpdate, { strict: false });
    const composer = new Composer();

    composer.on('my_chat_member', (ctx) => s.onMyChatMember(ctx));

    composer.start((ctx) => c.onStart(ctx));
    composer.command('menu', (ctx) => c.onMenuCommand(ctx));
    composer.command('profile', (ctx) => c.onProfileCommand(ctx));

    composer.action('qty:noop', (ctx) => c.onQtyNoop(ctx));
    composer.action(/^qty:(inc|dec):(.+):(\d+)$/, (ctx) => c.onQtyStep(ctx));
    composer.action(/^portion:sel:(.+):(\d+)$/, (ctx) => c.onPortionSelect(ctx));
    composer.action('cart:checkout', (ctx) => c.onCheckout(ctx));
    composer.action('checkout:cancel', (ctx) => c.onCheckoutCancel(ctx));
    composer.action(/^checkout:pay:(balance|cash)$/, (ctx) => c.onCheckoutPay(ctx));
    composer.action('profile:edit', (ctx) => c.onProfileEdit(ctx));
    composer.action(/^pedit:(name|phone|address|location|lang|password)$/, (ctx) => c.onProfileEditField(ctx));
    composer.action('topup', (ctx) => c.onTopup(ctx));
    composer.action(/^lang:(ru|uz)$/, (ctx) => c.onLanguage(ctx));
    composer.action('nav:orders', (ctx) => c.onNavOrders(ctx));
    composer.action('reg:skip_landmark', (ctx) => c.onSkipLandmark(ctx));

    composer.on('contact', (ctx) => c.onContact(ctx));
    composer.on(['location', 'venue'], (ctx) => c.onLocation(ctx));
    composer.on('photo', (ctx) => c.onPhoto(ctx));
    composer.on('text', (ctx, next) => c.onText(ctx, next));

    composer.command('chatid', (ctx) => s.onChatId(ctx));
    composer.command('bind', (ctx) => s.onBindCommand(ctx));
    composer.command('admin', (ctx) => s.onAdminCommand(ctx));
    composer.command('report', (ctx) => s.onReportCommand(ctx));

    composer.action('amenu:list', (ctx) => s.onMenuList(ctx));
    composer.action('amenu:add', (ctx) => s.onMenuAdd(ctx));
    composer.action(/^amenu:cat:(main|drink|dessert)$/, (ctx) => s.onMenuAddCat(ctx));
    composer.action(/^amenu:edit:(.+)$/, (ctx) => s.onMenuEdit(ctx));
    composer.action(/^amenu:fld:(.+):([a-z_]+)$/, (ctx) => s.onMenuField(ctx));
    composer.action(/^amenu:ecat:(.+):(main|drink|dessert)$/, (ctx) => s.onMenuEditCat(ctx));
    composer.action(/^amenu:days:(.+)$/, (ctx) => s.onMenuDays(ctx));
    composer.action(/^amenu:dayt:(.+):(\d)$/, (ctx) => s.onMenuDayToggle(ctx));
    composer.action(/^amenu:toggle:(.+)$/, (ctx) => s.onMenuToggle(ctx));
    composer.action(/^amenu:del:(.+)$/, (ctx) => s.onMenuDel(ctx));
    composer.action(/^amenu:delyes:(.+)$/, (ctx) => s.onMenuDelYes(ctx));

    composer.action('admin:deposit', (ctx) => s.onDeposit(ctx));
    composer.action('admin:withdraw', (ctx) => s.onWithdraw(ctx));
    composer.action(/^dep:pick:(.+)$/, (ctx) => s.onDepositPick(ctx));
    composer.action(/^wdr:pick:(.+)$/, (ctx) => s.onWithdrawPick(ctx));

    composer.action('admin:post', (ctx) => s.onPostList(ctx));
    composer.action(/^admin:post:(.+)$/, (ctx) => s.onPostPreview(ctx));
    composer.action(/^admin:publish:(.+)$/, (ctx) => s.onPublish(ctx));

    composer.action('admin:settings', (ctx) => s.onSettings(ctx));
    composer.action(/^admin:set:(topup_tg|topup_phone|support)$/, (ctx) => s.onSettingEdit(ctx));
    composer.action('admin:report', (ctx) => s.onReportAction(ctx));

    composer.action(/^ord:set:(.+?):([a-z]+)(?::([a-z]+))?$/, (ctx) => s.onTransition(ctx));

    composer.action(/^offer:accept:(.+)$/, (ctx) => c.onOfferAccept(ctx));

    return composer;
  }
}
