/**
 * MongoDB $jsonSchema Validators for the 5 Core Collections.
 * Applied at the database engine level to guarantee integrity even for writes bypassing the application.
 */

export const userJsonSchema = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['name', 'email', 'passwordHash', 'role', 'status'],
    properties: {
      name: {
        bsonType: 'string',
        minLength: 2,
        maxLength: 100,
        description: 'User display name between 2 and 100 characters',
      },
      email: {
        bsonType: 'string',
        pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
        description: 'Valid lowercased email address',
      },
      passwordHash: {
        bsonType: 'string',
        description: 'Argon2id PHC password hash string',
      },
      role: {
        enum: ['admin', 'staff', 'doctor', 'patient'],
        description: 'User role',
      },
      status: {
        enum: ['active', 'disabled'],
        description: 'Account status',
      },
      mustChangePassword: {
        bsonType: 'bool',
      },
      failedLoginCount: {
        bsonType: 'int',
        minimum: 0,
      },
      lockedUntil: {
        bsonType: ['date', 'null'],
      },
      passwordChangedAt: {
        bsonType: 'date',
      },
      lastLoginAt: {
        bsonType: ['date', 'null'],
      },
    },
  },
};

export const refreshTokenJsonSchema = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['userId', 'familyId', 'tokenHash', 'status', 'familyStartedAt', 'expiresAt'],
    properties: {
      userId: {
        bsonType: 'objectId',
        description: 'Foreign key referencing users collection',
      },
      familyId: {
        bsonType: 'string',
        description: 'UUID session family identifier for token rotation',
      },
      tokenHash: {
        bsonType: 'string',
        description: 'SHA-256 hash of refresh token',
      },
      status: {
        enum: ['active', 'used', 'revoked'],
      },
      familyStartedAt: {
        bsonType: 'date',
      },
      expiresAt: {
        bsonType: 'date',
      },
      revokedReason: {
        enum: ['logout', 'reuse', 'password_change', 'disabled', 'admin', null],
      },
      ip: {
        bsonType: ['string', 'null'],
      },
      userAgent: {
        bsonType: ['string', 'null'],
      },
    },
  },
};

export const doctorJsonSchema = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['name', 'specialization', 'hospital', 'phone', 'email', 'patientCount'],
    properties: {
      name: {
        bsonType: 'string',
        minLength: 2,
        maxLength: 100,
      },
      specialization: {
        bsonType: 'string',
        minLength: 2,
        maxLength: 100,
      },
      hospital: {
        bsonType: 'string',
        minLength: 2,
        maxLength: 100,
      },
      phone: {
        bsonType: 'string',
      },
      email: {
        bsonType: 'string',
      },
      patientCount: {
        bsonType: 'int',
        minimum: 0,
        description: 'Maintained computed patient counter',
      },
      searchTokens: {
        bsonType: 'array',
        items: {
          bsonType: 'string',
        },
      },
      createdBy: {
        bsonType: ['objectId', 'null'],
      },
    },
  },
};

export const patientJsonSchema = {
  $jsonSchema: {
    bsonType: 'object',
    required: [
      'name',
      'age',
      'gender',
      'phone',
      'condition',
      'admissionDate',
      'doctorId',
      'doctorName',
    ],
    properties: {
      name: {
        bsonType: 'string',
        minLength: 2,
        maxLength: 100,
      },
      age: {
        bsonType: 'int',
        minimum: 0,
        maximum: 130,
      },
      gender: {
        enum: ['male', 'female', 'other'],
      },
      phone: {
        bsonType: 'string',
      },
      email: {
        bsonType: ['string', 'null'],
      },
      condition: {
        enum: ['stable', 'under_observation', 'critical', 'recovering', 'discharged'],
      },
      diagnosis: {
        bsonType: ['string', 'null'],
        maxLength: 200,
      },
      admissionDate: {
        bsonType: 'date',
      },
      notes: {
        bsonType: ['string', 'null'],
        maxLength: 2000,
      },
      doctorId: {
        bsonType: 'objectId',
        description: 'Reference to assigned doctor in doctors collection',
      },
      doctorName: {
        bsonType: 'string',
        description: 'Extended reference copy of assigned doctor name',
      },
      searchTokens: {
        bsonType: 'array',
        items: {
          bsonType: 'string',
        },
      },
      createdBy: {
        bsonType: ['objectId', 'null'],
      },
      updatedBy: {
        bsonType: ['objectId', 'null'],
      },
    },
  },
};

export const auditLogJsonSchema = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['at', 'action'],
    properties: {
      at: {
        bsonType: 'date',
      },
      actorId: {
        bsonType: ['objectId', 'null'],
      },
      action: {
        bsonType: 'string',
      },
      entityType: {
        bsonType: ['string', 'null'],
      },
      entityId: {
        bsonType: ['objectId', 'null'],
      },
      fields: {
        bsonType: 'array',
        items: {
          bsonType: 'string',
        },
      },
      ip: {
        bsonType: ['string', 'null'],
      },
      userAgent: {
        bsonType: ['string', 'null'],
      },
    },
  },
};

