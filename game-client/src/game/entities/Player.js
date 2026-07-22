import Phaser from 'phaser';
export class Player extends Phaser.Physics.Arcade.Sprite {
    speed = 220;
    interactionRange = 104;
    state = 'idle';
    direction = 'down';
    virtual = new Phaser.Math.Vector2(0, 0);
    idleTexture;
    walkTexture;
    walkAnimationKey;
    walkDisplaySize;
    constructor(scene, x, y, avatarGender) {
        const requestedTexture = avatarGender === 'male' ? 'player-male' : 'player-female';
        const texture = scene.textures.exists(requestedTexture) ? requestedTexture : 'player-female';
        super(scene, x, y, texture);
        const gender = texture === 'player-male' ? 'male' : 'female';
        this.idleTexture = texture;
        this.walkTexture = `player-${gender}-walk`;
        this.walkAnimationKey = `player-${gender}-walk-cycle`;
        this.walkDisplaySize = gender === 'female' ? 91.5 : 86.5;
        scene.add.existing(this);
        scene.physics.add.existing(this);
        this.setCollideWorldBounds(true);
        this.setDepth(y);
        this.setDisplaySize(84, 84);
        this.syncCollisionBody();
    }
    setVirtualDirection(x, y) {
        this.virtual.set(x, y);
    }
    move(cursors, wasd) {
        if (this.state === 'disabled' || this.state === 'battle') {
            this.setVelocity(0);
            this.stopWalkAnimation();
            return;
        }
        const input = new Phaser.Math.Vector2(Number(cursors.right.isDown || wasd.D.isDown) - Number(cursors.left.isDown || wasd.A.isDown), Number(cursors.down.isDown || wasd.S.isDown) - Number(cursors.up.isDown || wasd.W.isDown)).add(this.virtual);
        if (input.lengthSq() === 0) {
            this.setVelocity(0);
            this.state = 'idle';
            this.stopWalkAnimation();
            this.setDepth(this.y);
            return;
        }
        input.normalize().scale(this.speed);
        this.setVelocity(input.x, input.y);
        this.state = 'walk';
        this.startWalkAnimation();
        if (Math.abs(input.x) > Math.abs(input.y)) {
            this.direction = input.x > 0 ? 'right' : 'left';
        }
        else {
            this.direction = input.y > 0 ? 'down' : 'up';
        }
        this.setFlipX(this.direction === 'left');
        this.setDepth(this.y);
    }
    startWalkAnimation() {
        if (this.anims.currentAnim?.key === this.walkAnimationKey && this.anims.isPlaying)
            return;
        this.setTexture(this.walkTexture, 0).setDisplaySize(this.walkDisplaySize, this.walkDisplaySize);
        this.syncCollisionBody();
        this.play(this.walkAnimationKey);
    }
    stopWalkAnimation() {
        if (this.texture.key === this.idleTexture)
            return;
        this.stop();
        this.setTexture(this.idleTexture).setDisplaySize(84, 84);
        this.syncCollisionBody();
    }
    syncCollisionBody() {
        const frameWidth = this.frame.realWidth;
        const frameHeight = this.frame.realHeight;
        const scale = Math.abs(this.scaleX);
        const radius = 20 / scale;
        const offsetX = frameWidth / 2 - radius;
        const offsetY = frameHeight / 2 + 17 / scale - radius;
        this.setCircle(radius, offsetX, offsetY);
    }
}
