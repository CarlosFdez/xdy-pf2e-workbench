import { CombatantPF2e } from "@module/encounter";
import { shouldIHandleThis } from "../../utils";
import { MODULENAME } from "../../xdy-pf2e-workbench";
import { ActorPF2e } from "@actor";

export async function reduceFrightened(combatant: CombatantPF2e) {
    if (combatant && combatant.actor && shouldIHandleThis(combatant.isOwner ? game.user?.id : null)) {
        if (combatant.actor.hasCondition("frightened")) {
            const minimumFrightened = <number>combatant.actor?.getFlag(MODULENAME, "condition.frightened.min") ?? 0;
            const currentFrightened = combatant.actor?.getCondition("frightened")?.value ?? 0;
            if (currentFrightened - 1 >= minimumFrightened) {
                await combatant.actor.decreaseCondition("frightened");
            }
        }
    }
}

export async function increaseDyingOnZeroHP(
    actor: ActorPF2e,
    update: Record<string, string>,
    hp: number
): Promise<boolean> {
    if (
        shouldIHandleThis(actor.isOwner ? game.user?.id : null) &&
        // @ts-ignore
        hp > 0 &&
        getProperty(update, "data.attributes.hp.value") <= 0
    ) {
        const orcFerocity = actor.data.items.find((feat) => feat.slug === "orc-ferocity");
        const incredibleFerocity = actor.data.items.find((feat) => feat.slug === "incredible-ferocity");
        const undyingFerocity = actor.data.items.find((feat) => feat.slug === "undying-ferocity");
        const rampagingFerocity = actor.data.items.find((feat) => feat.slug === "rampaging-ferocity");
        const orcFerocityUsed = actor.data.items.find((effect) => effect.slug === "orc-ferocity-used");

        if (orcFerocity && !orcFerocityUsed) {
            setProperty(update, "data.attributes.hp.value", 1);
            if (undyingFerocity) {
                setProperty(update, "data.attributes.hp.temp", Math.max(actor.level, actor.hitPoints?.temp ?? 0));
            }
            await actor.increaseCondition("wounded");

            const effect: any = {
                type: "effect",
                name: game.i18n.localize(`${MODULENAME}.effects.orcFerocityUsed`),
                img: "systems/pf2e/icons/default-icons/alternatives/ancestries/orc.svg",
                data: {
                    slug: "orc-ferocity-used",
                    tokenIcon: {
                        show: false,
                    },
                    duration: {
                        value: incredibleFerocity ? 1 : 24,
                        unit: "hours",
                        sustained: false,
                        expiry: "turn-start",
                    },
                },
            };

            await actor.createEmbeddedDocuments("Item", [effect]);

            if (rampagingFerocity) {
                await ChatMessage.create({
                    flavor: game.i18n.format(
                        `${
                            actor.token?.name ?? actor.name
                        } has just used Orc Ferocity and can now use the free action: ${TextEditor.enrichHTML(
                            `@Compendium[pf2e.actionspf2e.FkfWKq9jhhPzKAbb]{Rampaging Ferocity}`
                        )}.`
                    ),
                    speaker: ChatMessage.getSpeaker({ actor: actor }),
                    whisper:
                        game.settings.get("pf2e", "metagame.secretDamage") && !actor?.hasPlayerOwner
                            ? ChatMessage.getWhisperRecipients("GM").map((u) => u.id)
                            : [],
                });
            }
            await actor.update(update);
            return false;
        }
        let value = 1;
        const option = <string>game.settings.get(MODULENAME, "autoGainDyingAtZeroHP");
        if (option.endsWith("ForCharacters") ? actor.data.type === "character" : true) {
            if (option?.startsWith("addWoundedLevel")) {
                value = (actor.getCondition("wounded")?.value ?? 0) + 1;
            }
            for (let i = 0; i < Math.max(1, value); i++) {
                await actor.increaseCondition("dying");
            }
        }
    }
    return true;
}
