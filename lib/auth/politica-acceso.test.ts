import { describe, expect, it } from 'vitest';

import { decidirAcceso, type UsuarioExistente } from './politica-acceso';

function existente(sobrescribe: Partial<UsuarioExistente> = {}): UsuarioExistente {
  return { mfaEnabled: false, yaVinculado: false, bloqueada: false, ...sobrescribe };
}

describe('decidirAcceso — cuentas nuevas', () => {
  it('deja entrar por Google si el proveedor confirma el correo', () => {
    expect(
      decidirAcceso({
        proveedor: 'oauth',
        correoVerificadoPorProveedor: true,
        existente: null,
      }),
    ).toEqual({ permitido: true });
  });

  it('no deja crear una cuenta con un correo que el proveedor no verifica', () => {
    // Si no, alguien reclama una dirección que no controla y se queda dentro
    // esperando a que inviten a su dueño de verdad.
    expect(
      decidirAcceso({
        proveedor: 'oauth',
        correoVerificadoPorProveedor: false,
        existente: null,
      }),
    ).toEqual({ permitido: false, motivo: 'CORREO_NO_VERIFICADO' });
  });

  it('trata la ausencia de dato como no verificado', () => {
    expect(decidirAcceso({ proveedor: 'oauth', existente: null }).permitido).toBe(false);
  });

  it('deja entrar por enlace mágico sin más comprobaciones', () => {
    // Recibir el enlace ya demuestra el control del buzón.
    expect(decidirAcceso({ proveedor: 'email', existente: null })).toEqual({ permitido: true });
  });
});

describe('decidirAcceso — vinculación con una cuenta que ya existe', () => {
  it('vincula Google a una cuenta existente si el correo está verificado', () => {
    expect(
      decidirAcceso({
        proveedor: 'oauth',
        correoVerificadoPorProveedor: true,
        existente: existente(),
      }),
    ).toEqual({ permitido: true });
  });

  it('se niega a vincular cuando el proveedor no verifica el correo', () => {
    expect(
      decidirAcceso({
        proveedor: 'oauth',
        correoVerificadoPorProveedor: false,
        existente: existente(),
      }),
    ).toEqual({ permitido: false, motivo: 'CORREO_NO_VERIFICADO' });
  });

  it('deja pasar una cuenta ya vinculada', () => {
    expect(
      decidirAcceso({
        proveedor: 'oauth',
        correoVerificadoPorProveedor: false,
        existente: existente({ yaVinculado: true }),
      }),
    ).toEqual({ permitido: true });
  });
});

describe('decidirAcceso — el segundo factor no se puede saltar', () => {
  it('rechaza Google si la cuenta tiene MFA, aunque el correo esté verificado', () => {
    expect(
      decidirAcceso({
        proveedor: 'oauth',
        correoVerificadoPorProveedor: true,
        existente: existente({ mfaEnabled: true }),
      }),
    ).toEqual({ permitido: false, motivo: 'REQUIERE_SEGUNDO_FACTOR' });
  });

  it('lo rechaza también si la cuenta de Google ya estaba vinculada', () => {
    // Vincular antes y activar MFA después no puede dejar una puerta abierta.
    expect(
      decidirAcceso({
        proveedor: 'oauth',
        correoVerificadoPorProveedor: true,
        existente: existente({ mfaEnabled: true, yaVinculado: true }),
      }),
    ).toEqual({ permitido: false, motivo: 'REQUIERE_SEGUNDO_FACTOR' });
  });

  it('rechaza igualmente el enlace mágico', () => {
    expect(
      decidirAcceso({ proveedor: 'email', existente: existente({ mfaEnabled: true }) }),
    ).toEqual({ permitido: false, motivo: 'REQUIERE_SEGUNDO_FACTOR' });
  });
});

describe('decidirAcceso — cuentas no disponibles', () => {
  it('rechaza una cuenta bloqueada antes que ninguna otra cosa', () => {
    expect(
      decidirAcceso({
        proveedor: 'email',
        existente: existente({ bloqueada: true, mfaEnabled: true }),
      }),
    ).toEqual({ permitido: false, motivo: 'CUENTA_NO_DISPONIBLE' });
  });

  it('una cuenta bloqueada tampoco entra por Google', () => {
    expect(
      decidirAcceso({
        proveedor: 'oauth',
        correoVerificadoPorProveedor: true,
        existente: existente({ bloqueada: true }),
      }),
    ).toEqual({ permitido: false, motivo: 'CUENTA_NO_DISPONIBLE' });
  });
});
