import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePqrs1779960000000 implements MigrationInterface {
    name = 'CreatePqrs1779960000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`pqrs\` (\`id\` int NOT NULL AUTO_INCREMENT, \`radicado\` varchar(20) NULL, \`tipo\` enum('PETICION','QUEJA','RECLAMO','SUGERENCIA') NOT NULL, \`categoria\` enum('CONDUCTOR','BUS','RUTA','TARJETA','OTRO') NOT NULL, \`descripcion\` varchar(500) NOT NULL, \`email\` varchar(150) NOT NULL, \`estado\` enum('PENDIENTE','EN_REVISION','EN_PROCESO','RESUELTO') NOT NULL DEFAULT 'PENDIENTE', \`respuesta\` varchar(1000) NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`IDX_pqrs_radicado\` (\`radicado\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS \`pqrs\``);
    }
}
