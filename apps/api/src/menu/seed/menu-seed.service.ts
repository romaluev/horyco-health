import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { Category } from '@eatfit/shared';
import { BusinessesRepository } from '../../businesses/businesses.repository';
import { DefaultBusinessService } from '../../businesses/default-business.service';
import { Money } from '../../common/money/money';
import { ModifiersRepository } from '../../modifiers/modifiers.repository';
import { ModifierSelectionType } from '../../modifiers/entities/modifier.entity';
import { MenuRepository } from '../menu.repository';
import { BOWL_SEED_ITEMS } from './bowls.seed';
import { MODIFIER_GROUP_SEEDS } from './modifier-groups.seed';
import { DEFAULT_SEED_BUSINESS_ID, ModifierGroupKey } from './seed-helpers';

@Injectable()
export class MenuSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MenuSeedService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly businesses: BusinessesRepository,
    private readonly defaultBusiness: DefaultBusinessService,
    private readonly menu: MenuRepository,
    private readonly modifiers: ModifiersRepository,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.get<boolean>('seed.menu.enabled')) return;

    try {
      const businessId = await this.resolveBusinessId();
      const price = this.config.get<number>('seed.menu.price') ?? 55000;
      this.logger.log(`Menu seed: business=${businessId}, price=${price}`);

      const groupIds = await this.ensureModifierGroups(businessId);
      let inserted = 0;
      let skipped = 0;

      for (const bowl of BOWL_SEED_ITEMS) {
        const existing = await this.menu.findByNameRu(businessId, bowl.nameRu);
        if (existing) {
          skipped++;
          continue;
        }

        const photo = this.loadPhoto(bowl.photoFile);
        const item = await this.menu.create({
          businessId,
          category: bowl.category ?? Category.Main,
          nameRu: bowl.nameRu,
          nameUz: bowl.nameUz,
          descriptionRu: null,
          descriptionUz: null,
          price: Money.fromMajor(price),
          photoData: photo?.data ?? null,
          photoMime: photo?.mime ?? null,
          photoFileId: null,
          photoUrl: null,
          weightGrams: bowl.weightGrams,
          price2: null,
          weightGrams2: null,
          orderDeadline: null,
          ingredients: bowl.ingredients,
          allergens: null,
          nutrition: bowl.nutrition,
          nutrition2: null,
          instructions: bowl.instructions,
          tipRu: bowl.tipRu,
          tipUz: bowl.tipRu,
          isActive: true,
          days: bowl.days ?? [1, 2, 3, 4, 5, 6, 7],
        });

        const attachGroupIds = bowl.modifierGroups
          .map((key) => groupIds.get(key))
          .filter((id): id is string => Boolean(id));

        if (attachGroupIds.length > 0) {
          await this.modifiers.setMenuItemGroups(businessId, item.id, attachGroupIds);
        }

        inserted++;
        this.logger.log(`Menu seed: inserted «${bowl.nameRu}»`);
      }

      this.logger.log(`Menu seed done: ${inserted} inserted, ${skipped} skipped`);
    } catch (err) {
      this.logger.error('Menu seed failed', err);
    }
  }

  private async resolveBusinessId(): Promise<string> {
    const configured = this.config.get<string>('seed.menu.businessId');
    if (configured) {
      const biz = await this.businesses.findById(configured);
      if (biz) return biz.id;
      this.logger.warn(`Menu seed: business ${configured} not found, falling back to default`);
    }
    return this.defaultBusiness.getId();
  }

  private async ensureModifierGroups(
    businessId: string,
  ): Promise<Map<ModifierGroupKey, string>> {
    const ids = new Map<ModifierGroupKey, string>();

    for (const seed of MODIFIER_GROUP_SEEDS) {
      let group = await this.modifiers.findGroupByNameRu(businessId, seed.nameRu);
      if (!group) {
        group = await this.modifiers.save({
          businessId,
          nameRu: seed.nameRu,
          nameUz: seed.nameUz,
          kind: seed.kind,
          selectionType: seed.selectionType,
          pricingType: seed.pricingType,
          minSelect: seed.isRequired ? 1 : 0,
          maxSelect: seed.selectionType === ModifierSelectionType.Single ? 1 : null,
          isRequired: seed.isRequired,
          isActive: true,
          sortOrder: seed.sortOrder,
        });

        for (const opt of seed.options) {
          await this.modifiers.saveModifier(businessId, {
            groupId: group.id,
            nameRu: opt.nameRu,
            nameUz: opt.nameUz,
            priceDelta: Money.fromMajor(opt.priceDelta),
            isActive: true,
            sortOrder: opt.sortOrder,
          });
        }
        this.logger.log(`Menu seed: created modifier group «${seed.nameRu}»`);
      }
      ids.set(seed.key, group.id);
    }

    return ids;
  }

  private loadPhoto(filename: string): { data: Buffer; mime: string } | null {
    const path = join(__dirname, 'photos', filename);
    if (!existsSync(path)) {
      this.logger.warn(`Menu seed: photo not found ${path}`);
      return null;
    }
    const data = readFileSync(path);
    const ext = filename.split('.').pop()?.toLowerCase();
    const mime =
      ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    return { data, mime };
  }
}
