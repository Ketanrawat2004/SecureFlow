# SecureFlow — AWS Free Tier ($0/month) Deployment Guide

This guide walks you through deploying **SecureFlow** on the **AWS Free Tier** at **$0.00 / month**.

---

## 🏛️ Architecture Overview (AWS Free Tier)

```
                       ┌────────────────────────┐
                       │   User / Web Browser   │
                       └───────────┬────────────┘
                                   │ HTTPS / HTTP (Port 80/443)
                                   ▼
                    ┌───────────────────────────────┐
                    │      AWS EC2 (t2.micro /      │
                    │           t3.micro)           │
                    │   750 hrs/month (100% FREE)   │
                    │                               │
                    │  ┌─────────────────────────┐  │
                    │  │ NGINX (Frontend Proxy)  │  │
                    │  └───────────┬─────────────┘  │
                    │              │                │
                    │  ┌───────────▼─────────────┐  │
                    │  │ FastAPI Backend (:8000) │  │
                    │  └───────┬───────────┬─────┘  │
                    │          │           │        │
                    │  ┌───────▼────┐ ┌────▼──────┐ │
                    │  │ PostgreSQL │ │   Redis   │ │
                    │  └────────────┘ └───────────┘ │
                    └───────────────────────────────┘
```

---

## 🚀 Step 1: Launch an AWS EC2 Free Tier Instance

1. Sign in to your **[AWS Management Console](https://console.aws.amazon.com/)**.
2. Search for **EC2** and click **Launch instance**.
3. Configure the instance:
   - **Name**: `secureflow-server`
   - **OS / AMI**: **Ubuntu Server 24.04 LTS (HVM)** (*Free tier eligible*)
   - **Instance type**: `t2.micro` (or `t3.micro` depending on region) (*Free tier eligible*)
   - **Key pair**: Select **Create new key pair**, name it `secureflow-key.pem`, and download it to your computer.
4. **Network / Security Group Settings**:
   - Check **Allow SSH traffic from** (Anywhere `0.0.0.0/0` or My IP)
   - Check **Allow HTTP traffic from the internet** (Port `80`)
   - Check **Allow HTTPS traffic from the internet** (Port `443`)
   - Add Custom TCP Rule: Port **`8000`** (Source: Anywhere `0.0.0.0/0`)
5. **Storage**: 20 GB (Up to 30 GB gp3 is Free Tier eligible).
6. Click **Launch instance**.

---

## 💻 Step 2: Connect to Your EC2 Instance

Open your terminal (PowerShell, Command Prompt, or Git Bash) on your computer where `secureflow-key.pem` is downloaded:

```bash
# Set key permissions (on Linux/Mac: chmod 400 secureflow-key.pem)
ssh -i "secureflow-key.pem" ubuntu@<YOUR-EC2-PUBLIC-IP>
```

---

## ⚡ Step 3: Run the 1-Command Automated Setup

Once connected to your Ubuntu EC2 terminal, copy and paste this one-command installation:

```bash
# 1. Update system and install Docker & Docker Compose
sudo apt-get update -y && sudo apt-get upgrade -y
sudo apt-get install -y ca-certificates curl gnupg git

# Install Docker
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Add ubuntu user to docker group
sudo usermod -aG docker ubuntu
```

---

## 📦 Step 4: Clone SecureFlow & Start Application

```bash
# Clone the repository
git clone https://github.com/Ketanrawat2004/SecureFlow.git
cd SecureFlow

# Configure environment
cp .env.example .env

# Generate a secure JWT Secret Key
JWT_SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))" 2>/dev/null || openssl rand -hex 32)
sed -i "s/your-32-byte-secret-key-here/$JWT_SECRET/g" .env

# Add your Google OAuth credentials to .env
# nano .env
# Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
# Set OAUTH_REDIRECT_URI=http://<YOUR-EC2-PUBLIC-IP>:3000/auth/callback (or port 80)

# Build and start the full production stack with Docker Compose
sudo docker compose up -d --build
```

---

## 🌐 Step 5: Configure Google Cloud Console for AWS

1. Go to **[Google Cloud Console Credentials](https://console.cloud.google.com/apis/credentials)**.
2. Under **Authorized JavaScript origins**, add:
   - `http://<YOUR-EC2-PUBLIC-IP>:3000` (or `http://<YOUR-EC2-PUBLIC-IP>`)
3. Under **Authorized redirect URIs**, add:
   - `http://<YOUR-EC2-PUBLIC-IP>:3000/auth/callback` (or `http://<YOUR-EC2-PUBLIC-IP>/auth/callback`)
4. Click **Save**.

---

## 🛡️ Step 6: Verify Live Deployment

Open your browser and visit:
- **Frontend Dashboard**: `http://<YOUR-EC2-PUBLIC-IP>:3000` (or `http://<YOUR-EC2-PUBLIC-IP>`)
- **Backend API Health Check**: `http://<YOUR-EC2-PUBLIC-IP>:8000/health`
- **Interactive OpenAPI Documentation**: `http://<YOUR-EC2-PUBLIC-IP>:8000/docs`

---

## 💡 Pro Tip: Free SSL Certificate (HTTPS) with Let's Encrypt

If you attach a free domain or subdomain (e.g. from DuckDNS, Cloudflare, or Route 53):

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

---

## 📊 AWS Free Tier Cost Checklist

| AWS Resource | Free Tier Allowance | SecureFlow Usage | Monthly Cost |
|---|---|---|---|
| **EC2 `t2.micro` / `t3.micro`** | 750 hours/month | 1 instance (744 hrs) | **$0.00** |
| **EBS Storage** | 30 GB gp3 / gp2 | 20 GB gp3 | **$0.00** |
| **Data Transfer** | 100 GB Out / month | ~5 GB / month | **$0.00** |
| **Total Cost** | — | — | **$0.00 / month** |
