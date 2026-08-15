from typing import List
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.entities import Permission, Role, RolePermission
from app.schemas.role import (
    PermissionResponse,
    RolePermissionMatrixGroup,
    RolePermissionMatrixResponse,
    RoleResponse,
)


class RoleService:
    @staticmethod
    async def get_roles(db: AsyncSession) -> List[RoleResponse]:
        """Fetch all system and organization roles with their attached permissions."""
        stmt = (
            select(Role)
            .options(
                selectinload(Role.role_permissions).selectinload(RolePermission.permission)
            )
            .order_by(Role.is_system.desc(), Role.name.asc())
        )
        result = await db.execute(stmt)
        roles = result.scalars().all()

        responses = []
        for r in roles:
            perms = [PermissionResponse.model_validate(rp.permission) for rp in r.role_permissions]
            resp = RoleResponse(
                id=r.id,
                name=r.name,
                description=r.description,
                is_system=r.is_system,
                organization_id=r.organization_id,
                permissions=perms,
            )
            responses.append(resp)
        return responses

    @staticmethod
    async def get_permissions(db: AsyncSession) -> List[PermissionResponse]:
        """Fetch all permissions."""
        stmt = select(Permission).order_by(Permission.category.asc(), Permission.code.asc())
        result = await db.execute(stmt)
        return [PermissionResponse.model_validate(p) for p in result.scalars().all()]

    @staticmethod
    async def get_role_permission_matrix(db: AsyncSession) -> RolePermissionMatrixResponse:
        """Fetch full grouped permission matrix for the RBAC management interface."""
        roles = await RoleService.get_roles(db)
        permissions = await RoleService.get_permissions(db)

        # Group permissions by category
        grouped = {}
        for p in permissions:
            if p.category not in grouped:
                grouped[p.category] = []
            grouped[p.category].append(p)

        categories = [
            RolePermissionMatrixGroup(category=cat, permissions=perms)
            for cat, perms in grouped.items()
        ]

        return RolePermissionMatrixResponse(roles=roles, categories=categories)


role_service = RoleService()
