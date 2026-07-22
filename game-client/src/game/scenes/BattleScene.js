import Phaser from 'phaser';
import { CardSpirit } from '@/game/entities/CardSpirit';
import { gameEvents } from '@/game/events';
export class BattleScene extends Phaser.Scene {
    enemy;
    playerSpirit;
    constructor() {
        super('BattleScene');
    }
    create(data) {
        const { width, height } = this.scale;
        const profile = this.registry.get('world-player');
        const avatarGender = profile.avatar_gender === 'male' ? 'male' : 'female';
        this.add.image(width / 2, height / 2, 'moon-arena').setDisplaySize(width, height);
        this.add
            .text(width / 2, 54, '月影竞技场', {
            fontFamily: 'ui-rounded, sans-serif',
            fontSize: '30px',
            color: '#fff1bd',
        })
            .setOrigin(0.5);
        this.enemy = new CardSpirit(this, width * 0.72, height * 0.42, data.enemyName ?? '训练木偶', 'npc', 0xb45309);
        this.playerSpirit = new CardSpirit(this, width * 0.28, height * 0.58, profile.name, `player-${avatarGender}-combat`, 0x15803d);
        gameEvents.on('battle:action', this.onBattleAction);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            gameEvents.off('battle:action', this.onBattleAction);
        });
    }
    onBattleAction = ({ target, targetDefeated, result, }) => {
        const attacker = target === 'enemy' ? this.playerSpirit : this.enemy;
        const defender = target === 'enemy' ? this.enemy : this.playerSpirit;
        if (!attacker || !defender)
            return;
        attacker.playAttack(target === 'enemy' ? 1 : -1, () => {
            defender.playHit(() => {
                if (targetDefeated)
                    defender.playDeath();
                if (result === 'victory')
                    this.time.delayedCall(180, () => this.playerSpirit.playVictory());
                if (result === 'defeat')
                    this.time.delayedCall(180, () => this.enemy.playVictory());
            });
        });
    };
}
